import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { AuthUser } from '../auth/types/request-user.type';
import { AnalyticsScopeService } from '../analytics/analytics-scope.service';
import { TenantAccessService } from '../tenants/tenant-access.service';
import { PaymentsService } from './payments.service';
import type { PaymentsRecentTransactionsQueryDto } from './dto/payments-dashboard-query.dto';

@Injectable()
export class PaymentsDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
    private readonly payments: PaymentsService,
    private readonly analyticsScope: AnalyticsScopeService,
    private readonly config: ConfigService,
  ) {}

  private stalePendingMs(): number {
    const h = this.config.get<number>('payments.stalePendingHours', 48);
    return Math.max(1, h) * 60 * 60 * 1000;
  }

  private webhookStaleMs(): number {
    const h = this.config.get<number>('payments.webhookStaleHours', 72);
    return Math.max(1, h) * 60 * 60 * 1000;
  }

  private async resolveDashboardScope(
    user: AuthUser,
    tenantId?: string,
    branchId?: string,
  ) {
    const { start, end } = this.analyticsScope.parseDates(undefined, undefined);
    return this.analyticsScope.resolve(user, tenantId, branchId, undefined, undefined, 'day');
  }

  async dashboardSummary(user: AuthUser, tenantId?: string, branchId?: string) {
    const scope = await this.resolveDashboardScope(user, tenantId, branchId);
    const pWhere = this.analyticsScope.paymentWhere(scope);
    const configHealthPromise =
      !scope.allTenants && scope.tenantIds?.length === 1
        ? this.configHealth(user, scope.tenantIds[0])
        : Promise.resolve({
            tenantId: null as string | null,
            providers: [] as unknown[],
            note: scope.allTenants
              ? 'Pass tenantId for per-tenant provider health'
              : 'tenantId could not be resolved',
          });
    const [configHealth, byStatus, byType, pendingStale, failed7d] = await Promise.all([
      configHealthPromise,
      this.prisma.paymentTransaction.groupBy({
        by: ['status'],
        where: pWhere,
        _count: true,
        _sum: { amountCents: true },
      }),
      this.prisma.paymentTransaction.groupBy({
        by: ['type'],
        where: pWhere,
        _count: true,
        _sum: { amountCents: true },
      }),
      this.prisma.paymentTransaction.count({
        where: {
          ...pWhere,
          status: 'PENDING',
          updatedAt: { lt: new Date(Date.now() - this.stalePendingMs()) },
        },
      }),
      this.prisma.paymentTransaction.count({
        where: {
          ...pWhere,
          status: 'FAILED',
          updatedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      period: { start: scope.start.toISOString(), end: scope.end.toISOString() },
      scope: {
        allTenants: scope.allTenants,
        tenantIds: scope.tenantIds,
        branchIds: scope.branchIds,
      },
      configHealth,
      payments: {
        byStatus: byStatus.map((g) => ({
          status: g.status,
          count: g._count,
          amountCents: g._sum.amountCents ?? 0,
        })),
        byType: byType.map((g) => ({
          type: g.type,
          count: g._count,
          amountCents: g._sum.amountCents ?? 0,
        })),
      },
      reconciliationPreview: {
        stalePendingCount: pendingStale,
        failedLast7DaysCount: failed7d,
      },
    };
  }

  async configHealth(user: AuthUser, tenantId: string, _branchId?: string) {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    await this.access.assertReadableTenant(user, tenantId);
    const rows = await this.prisma.paymentProviderConfig.findMany({ where: { tenantId } });
    const masked = rows.map((r) => this.payments.maskConfigPublic(r));
    return {
      tenantId,
      providers: masked.map((m) => ({
        id: m.id,
        provider: m.provider,
        displayName: m.displayName,
        isActive: m.isActive,
        collectionEnabled: m.collectionEnabled,
        payoutEnabled: m.payoutEnabled,
        webhookConfigured: Boolean(m.credentialsPreview?.webhookSecretSet),
        credentialsMasked: true,
        lastWebhookAt: m.lastWebhookAt,
        updatedAt: m.updatedAt,
      })),
    };
  }

  async recentTransactions(user: AuthUser, q: PaymentsRecentTransactionsQueryDto) {
    const scope = await this.analyticsScope.resolve(
      user,
      q.tenantId,
      q.branchId,
      q.startDate,
      q.endDate,
      'day',
    );
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const extra: Prisma.PaymentTransactionWhereInput = {};
    if (q.type) {
      extra.type = q.type;
    }
    if (q.status) {
      extra.status = q.status;
    }
    const where = { ...this.analyticsScope.paymentWhere(scope), ...extra };
    const [items, total] = await Promise.all([
      this.prisma.paymentTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          type: true,
          amountCents: true,
          currency: true,
          status: true,
          orderReference: true,
          externalRef: true,
          lastProviderStatus: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.paymentTransaction.count({ where }),
    ]);
    return {
      page,
      pageSize,
      total,
      items,
    };
  }

  async reconciliationFlags(user: AuthUser, tenantId?: string, branchId?: string) {
    const scope = await this.resolveDashboardScope(user, tenantId, branchId);
    const pWhere = this.analyticsScope.paymentWhere(scope);
    const now = Date.now();
    const staleCut = new Date(now - this.stalePendingMs());

    const [stalePending, failedRecent, pendingCount, payoutPending, cfgRows] = await Promise.all([
      this.prisma.paymentTransaction.findMany({
        where: {
          ...pWhere,
          status: 'PENDING',
          updatedAt: { lt: staleCut },
        },
        orderBy: { updatedAt: 'asc' },
        take: 50,
        select: {
          id: true,
          orderReference: true,
          type: true,
          amountCents: true,
          updatedAt: true,
          lastProviderStatus: true,
        },
      }),
      this.prisma.paymentTransaction.findMany({
        where: {
          ...pWhere,
          status: 'FAILED',
          updatedAt: { gte: new Date(now - 7 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          orderReference: true,
          type: true,
          amountCents: true,
          updatedAt: true,
          lastProviderStatus: true,
        },
      }),
      this.prisma.paymentTransaction.count({
        where: { ...pWhere, status: 'PENDING' },
      }),
      this.prisma.paymentTransaction.count({
        where: { ...pWhere, type: 'PAYOUT', status: 'PENDING' },
      }),
      scope.tenantIds?.length === 1
        ? this.prisma.paymentProviderConfig.findMany({
            where: { tenantId: scope.tenantIds[0], isActive: true },
            select: { lastWebhookAt: true, provider: true },
          })
        : Promise.resolve(
            [] as { lastWebhookAt: Date | null; provider: string }[],
          ),
    ]);

    let webhookStale = false;
    if (cfgRows.length && pendingCount > 0) {
      let latestWh: Date | null = null;
      for (const c of cfgRows) {
        if (c.lastWebhookAt && (!latestWh || c.lastWebhookAt > latestWh)) {
          latestWh = c.lastWebhookAt;
        }
      }
      if (!latestWh || now - latestWh.getTime() > this.webhookStaleMs()) {
        webhookStale = true;
      }
    }

    const manualReviewQueue = stalePending.length + failedRecent.length;

    return {
      scope: {
        tenantIds: scope.tenantIds,
        branchIds: scope.branchIds,
        allTenants: scope.allTenants,
      },
      counts: {
        pendingTotal: pendingCount,
        payoutPendingTotal: payoutPending,
        stalePendingSampleSize: stalePending.length,
        failedRecentSampleSize: failedRecent.length,
        manualReviewQueueApprox: manualReviewQueue,
      },
      flags: {
        hasStalePending: stalePending.length > 0,
        hasRecentFailures: failedRecent.length > 0,
        webhookPossiblyStale: webhookStale,
      },
      samples: {
        stalePending,
        failedRecent,
      },
    };
  }
}
