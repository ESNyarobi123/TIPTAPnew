import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { AuthUser } from '../auth/types/request-user.type';
import { AnalyticsScopeService } from '../analytics/analytics-scope.service';
import type { StatementQueryDto } from './dto/statement-query.dto';

@Injectable()
export class StatementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsScope: AnalyticsScopeService,
  ) {}

  /** Opaque key = base64url(JSON) of statement parameters; stable for the same inputs. */
  buildDeterministicKey(dto: StatementQueryDto): string {
    const payload = JSON.stringify({
      tenantId: dto.tenantId,
      branchId: dto.branchId ?? null,
      startDate: dto.startDate,
      endDate: dto.endDate,
    });
    return Buffer.from(payload).toString('base64url');
  }

  parseKey(encoded: string): StatementQueryDto {
    try {
      const raw = Buffer.from(encoded, 'base64url').toString('utf8');
      const j = JSON.parse(raw) as StatementQueryDto;
      if (!j?.tenantId || !j?.startDate || !j?.endDate) {
        throw new Error('invalid');
      }
      return j;
    } catch {
      throw new BadRequestException('Invalid statement key');
    }
  }

  async buildStatement(user: AuthUser, dto: StatementQueryDto) {
    const scope = await this.analyticsScope.resolve(
      user,
      dto.tenantId,
      dto.branchId,
      dto.startDate,
      dto.endDate,
      'month',
    );
    const pWhere = this.analyticsScope.paymentWhere(scope);
    const tWhere = this.analyticsScope.tipWhere(scope);

    const [paymentGroups, tipModeGroups, failedPay, refundedPay, byBranch, payoutTrend] =
      await Promise.all([
        this.prisma.paymentTransaction.groupBy({
          by: ['type', 'status'],
          where: pWhere,
          _sum: { amountCents: true },
          _count: true,
        }),
        this.prisma.tip.groupBy({
          by: ['mode', 'status'],
          where: tWhere,
          _sum: { amountCents: true },
          _count: true,
        }),
        this.prisma.paymentTransaction.count({
          where: { ...pWhere, status: 'FAILED' },
        }),
        this.prisma.paymentTransaction.count({
          where: { ...pWhere, status: 'REFUNDED' },
        }),
        scope.branchIds == null && scope.tenantIds?.length === 1
          ? this.prisma.paymentTransaction.groupBy({
              by: ['branchId', 'type', 'status'],
              where: pWhere,
              _sum: { amountCents: true },
              _count: true,
            })
          : Promise.resolve([]),
        this.prisma.paymentTransaction.groupBy({
          by: ['status'],
          where: { ...pWhere, type: 'PAYOUT' },
          _count: true,
          _sum: { amountCents: true },
        }),
      ]);

    const sum = (type: string, status: string) =>
      paymentGroups
        .filter((g) => g.type === type && g.status === status)
        .reduce((s, g) => s + (g._sum.amountCents ?? 0), 0);

    const collectionsCompleted = sum('COLLECTION', 'COMPLETED');
    const payoutsCompleted = sum('PAYOUT', 'COMPLETED');
    const tipDigitalCompleted = sum('TIP_DIGITAL', 'COMPLETED');

    const cashTips = tipModeGroups
      .filter((g) => g.mode === 'CASH' && g.status === 'RECORDED')
      .reduce((s, g) => s + (g._sum.amountCents ?? 0), 0);
    const digitalTipsRecorded = tipModeGroups
      .filter((g) => g.mode === 'DIGITAL')
      .reduce((s, g) => s + (g._sum.amountCents ?? 0), 0);

    const feesCents: number | null = null;

    const netApproxCents =
      collectionsCompleted + tipDigitalCompleted - payoutsCompleted;

    const key = this.buildDeterministicKey(dto);

    return {
      statementKey: key,
      generatedAt: new Date().toISOString(),
      period: {
        start: scope.start.toISOString(),
        end: scope.end.toISOString(),
      },
      scope: {
        tenantIds: scope.tenantIds,
        branchIds: scope.branchIds,
      },
      settlementVisibility: {
        payoutStatusBreakdown: payoutTrend.map((g) => ({
          status: g.status,
          count: g._count,
          amountCents: g._sum.amountCents ?? 0,
        })),
      },
      totals: {
        collectionsCompletedCents: collectionsCompleted,
        payoutsCompletedCents: payoutsCompleted,
        digitalTipPaymentCompletedCents: tipDigitalCompleted,
        cashTipsRecordedCents: cashTips,
        digitalTipsAllStatusesCents: digitalTipsRecorded,
        failedPaymentTransactions: failedPay,
        refundedPaymentTransactions: refundedPay,
        feesCents,
        netMovementApproxCents: netApproxCents,
      },
      paymentBreakdown: paymentGroups.map((g) => ({
        type: g.type,
        status: g.status,
        count: g._count,
        amountCents: g._sum.amountCents ?? 0,
      })),
      tipBreakdown: tipModeGroups.map((g) => ({
        mode: g.mode,
        status: g.status,
        count: g._count,
        amountCents: g._sum.amountCents ?? 0,
      })),
      byBranch:
        byBranch?.map((g) => ({
          branchId: g.branchId,
          type: g.type,
          status: g.status,
          count: g._count,
          amountCents: g._sum.amountCents ?? 0,
        })) ?? [],
    };
  }
}
