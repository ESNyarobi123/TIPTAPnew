import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { AuthUser } from '../auth/types/request-user.type';
import { AnalyticsScopeService } from '../analytics/analytics-scope.service';
import { mapProviderStatusToTxn } from '../payments/payments.service';
import type {
  ReconciliationQueryDto,
  ReconciliationTransactionsQueryDto,
} from './dto/reconciliation-query.dto';

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsScope: AnalyticsScopeService,
    private readonly config: ConfigService,
  ) {}

  private stalePendingMs(): number {
    const h = this.config.get<number>('payments.stalePendingHours', 48);
    return Math.max(1, h) * 60 * 60 * 1000;
  }

  private txnMismatch(row: {
    status: string;
    lastProviderStatus: string | null;
  }): boolean {
    const mapped = mapProviderStatusToTxn(row.lastProviderStatus);
    if (mapped == null) {
      return false;
    }
    return mapped !== row.status;
  }

  async overview(user: AuthUser, q: ReconciliationQueryDto) {
    const scope = await this.analyticsScope.resolve(
      user,
      q.tenantId,
      q.branchId,
      q.startDate,
      q.endDate,
      'day',
    );
    const pWhere = this.analyticsScope.paymentWhere(scope);
    const now = Date.now();
    const staleCut = new Date(now - this.stalePendingMs());

    const rows = await this.prisma.paymentTransaction.findMany({
      where: pWhere,
      select: {
        id: true,
        status: true,
        lastProviderStatus: true,
        type: true,
        updatedAt: true,
      },
    });

    let mismatchCount = 0;
    let pendingWithProviderTerminal = 0;
    for (const r of rows) {
      if (this.txnMismatch(r)) {
        mismatchCount += 1;
      }
      const mapped = mapProviderStatusToTxn(r.lastProviderStatus);
      if (r.status === 'PENDING' && mapped && mapped !== 'PENDING') {
        pendingWithProviderTerminal += 1;
      }
    }

    const stalePending = rows.filter(
      (r) => r.status === 'PENDING' && r.updatedAt < staleCut,
    ).length;

    const failed = rows.filter((r) => r.status === 'FAILED').length;
    const payoutPending = rows.filter((r) => r.type === 'PAYOUT' && r.status === 'PENDING')
      .length;

    return {
      period: { start: scope.start.toISOString(), end: scope.end.toISOString() },
      scope: {
        allTenants: scope.allTenants,
        tenantIds: scope.tenantIds,
        branchIds: scope.branchIds,
      },
      counts: {
        transactionsInPeriod: rows.length,
        providerLocalStatusMismatch: mismatchCount,
        pendingButProviderSuggestsTerminal: pendingWithProviderTerminal,
        stalePending,
        failed,
        payoutPendingQueue: payoutPending,
      },
    };
  }

  async transactions(user: AuthUser, q: ReconciliationTransactionsQueryDto) {
    const scope = await this.analyticsScope.resolve(
      user,
      q.tenantId,
      q.branchId,
      q.startDate,
      q.endDate,
      'day',
    );
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 50;
    const extra: Prisma.PaymentTransactionWhereInput = {};
    if (q.type) {
      extra.type = q.type;
    }
    if (q.status) {
      extra.status = q.status;
    }
    let where: Prisma.PaymentTransactionWhereInput = {
      ...this.analyticsScope.paymentWhere(scope),
      ...extra,
    };

    if (q.mismatchOnly) {
      const candidates = await this.prisma.paymentTransaction.findMany({
        where,
        select: {
          id: true,
          status: true,
          lastProviderStatus: true,
        },
      });
      const ids = candidates.filter((r) => this.txnMismatch(r)).map((r) => r.id);
      where = { id: { in: ids } };
    }

    const [items, total] = await Promise.all([
      this.prisma.paymentTransaction.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          type: true,
          status: true,
          amountCents: true,
          currency: true,
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
      items: items.map((r) => ({
        ...r,
        providerMapsToStatus: mapProviderStatusToTxn(r.lastProviderStatus),
        mismatch: this.txnMismatch(r),
      })),
    };
  }

  async exceptions(user: AuthUser, q: ReconciliationQueryDto) {
    const scope = await this.analyticsScope.resolve(
      user,
      q.tenantId,
      q.branchId,
      q.startDate,
      q.endDate,
      'day',
    );
    const pWhere = this.analyticsScope.paymentWhere(scope);
    const now = Date.now();
    const staleCut = new Date(now - this.stalePendingMs());

    const [stalePending, failed, mismatches] = await Promise.all([
      this.prisma.paymentTransaction.findMany({
        where: {
          ...pWhere,
          status: 'PENDING',
          updatedAt: { lt: staleCut },
        },
        orderBy: { updatedAt: 'asc' },
        take: 100,
        select: {
          id: true,
          orderReference: true,
          type: true,
          amountCents: true,
          lastProviderStatus: true,
          updatedAt: true,
        },
      }),
      this.prisma.paymentTransaction.findMany({
        where: { ...pWhere, status: 'FAILED' },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        select: {
          id: true,
          orderReference: true,
          type: true,
          amountCents: true,
          lastProviderStatus: true,
          updatedAt: true,
        },
      }),
      this.prisma.paymentTransaction.findMany({
        where: pWhere,
        select: {
          id: true,
          orderReference: true,
          type: true,
          status: true,
          amountCents: true,
          lastProviderStatus: true,
          updatedAt: true,
        },
      }),
    ]);

    const mismatchRows = mismatches.filter((r) => this.txnMismatch(r)).slice(0, 100);

    return {
      period: { start: scope.start.toISOString(), end: scope.end.toISOString() },
      scope: {
        tenantIds: scope.tenantIds,
        branchIds: scope.branchIds,
        allTenants: scope.allTenants,
      },
      exceptionQueueApprox: stalePending.length + failed.length + mismatchRows.length,
      stalePending,
      failed,
      providerLocalMismatch: mismatchRows,
    };
  }
}
