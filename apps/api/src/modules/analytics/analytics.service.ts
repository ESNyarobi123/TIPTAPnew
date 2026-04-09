import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { AuthUser } from '../auth/types/request-user.type';
import type {
  AnalyticsPaymentsQueryDto,
  AnalyticsQueryDto,
  AnalyticsRatingsQueryDto,
  AnalyticsTipsQueryDto,
} from './dto/analytics-query.dto';
import {
  AnalyticsScopeService,
  type GroupByPeriod,
  type ResolvedAnalyticsScope,
} from './analytics-scope.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeSvc: AnalyticsScopeService,
  ) {}

  private async resolve(
    user: AuthUser,
    q: AnalyticsQueryDto,
  ): Promise<ResolvedAnalyticsScope> {
    return this.scopeSvc.resolve(
      user,
      q.tenantId,
      q.branchId,
      q.startDate,
      q.endDate,
      q.groupBy,
    );
  }

  private paymentBaseWhere(
    scope: ResolvedAnalyticsScope,
    extra?: Prisma.PaymentTransactionWhereInput,
  ): Prisma.PaymentTransactionWhereInput {
    return { ...this.scopeSvc.paymentWhere(scope), ...extra };
  }

  async overview(user: AuthUser, q: AnalyticsQueryDto) {
    const scope = await this.resolve(user, q);
    const pWhere = this.paymentBaseWhere(scope);
    const tWhere = this.scopeSvc.tipWhere(scope);
    const rWhere = this.scopeSvc.ratingWhere(scope);

    const [
      paymentStatusGroups,
      paymentTypeGroups,
      tipModeGroups,
      ratingAgg,
      ratingCount,
      pendingPayments,
      failedPayments,
    ] = await Promise.all([
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
      this.prisma.tip.groupBy({
        by: ['mode', 'status'],
        where: tWhere,
        _count: true,
        _sum: { amountCents: true },
      }),
      this.prisma.rating.aggregate({
        where: rWhere,
        _avg: { score: true },
        _count: true,
      }),
      this.prisma.rating.groupBy({
        by: ['targetType'],
        where: rWhere,
        _count: true,
      }),
      this.prisma.paymentTransaction.count({
        where: this.paymentBaseWhere(scope, { status: 'PENDING' }),
      }),
      this.prisma.paymentTransaction.count({
        where: this.paymentBaseWhere(scope, { status: 'FAILED' }),
      }),
    ]);

    return {
      period: { start: scope.start.toISOString(), end: scope.end.toISOString() },
      scope: {
        allTenants: scope.allTenants,
        tenantIds: scope.tenantIds,
        branchIds: scope.branchIds,
      },
      payments: {
        byStatus: paymentStatusGroups.map((g) => ({
          status: g.status,
          count: g._count,
          amountCents: g._sum.amountCents ?? 0,
        })),
        byType: paymentTypeGroups.map((g) => ({
          type: g.type,
          count: g._count,
          amountCents: g._sum.amountCents ?? 0,
        })),
        pendingCount: pendingPayments,
        failedCount: failedPayments,
      },
      tips: {
        byModeAndStatus: tipModeGroups.map((g) => ({
          mode: g.mode,
          status: g.status,
          count: g._count,
          amountCents: g._sum.amountCents ?? 0,
        })),
      },
      ratings: {
        averageScore: ratingAgg._avg.score,
        totalCount: ratingAgg._count,
        byTargetType: ratingCount.map((g) => ({
          targetType: g.targetType,
          count: g._count,
        })),
      },
    };
  }

  async payments(user: AuthUser, q: AnalyticsPaymentsQueryDto) {
    const scope = await this.resolve(user, q);
    const extra: Prisma.PaymentTransactionWhereInput = {};
    if (q.type) {
      extra.type = q.type;
    }
    if (q.status) {
      extra.status = q.status;
    }
    const pWhere = this.paymentBaseWhere(scope, extra);

    const [byStatus, byType, byBranch, byTenant, timeSeries, providerBreakdown] =
      await Promise.all([
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
        this.prisma.paymentTransaction.groupBy({
          by: ['branchId'],
          where: pWhere,
          _count: true,
          _sum: { amountCents: true },
        }),
        scope.allTenants
          ? this.prisma.paymentTransaction.groupBy({
              by: ['tenantId'],
              where: pWhere,
              _count: true,
              _sum: { amountCents: true },
            })
          : Promise.resolve([]),
        this.rawPaymentBuckets(scope, pWhere, scope.groupBy),
        this.prisma.paymentTransaction.groupBy({
          by: ['providerConfigId'],
          where: pWhere,
          _count: true,
          _sum: { amountCents: true },
        }),
      ]);

    return {
      period: { start: scope.start.toISOString(), end: scope.end.toISOString() },
      groupBy: scope.groupBy,
      filters: { type: q.type ?? null, status: q.status ?? null },
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
      byBranch: byBranch.map((g) => ({
        branchId: g.branchId,
        count: g._count,
        amountCents: g._sum.amountCents ?? 0,
      })),
      byTenant: byTenant.map((g) => ({
        tenantId: g.tenantId,
        count: g._count,
        amountCents: g._sum.amountCents ?? 0,
      })),
      volumeOverTime: timeSeries,
      byProviderConfigId: providerBreakdown.map((g) => ({
        providerConfigId: g.providerConfigId,
        count: g._count,
        amountCents: g._sum.amountCents ?? 0,
      })),
    };
  }

  private async rawPaymentBuckets(
    scope: ResolvedAnalyticsScope,
    where: Prisma.PaymentTransactionWhereInput,
    unit: GroupByPeriod,
  ) {
    const tenantClause =
      where.tenantId == null
        ? Prisma.empty
        : typeof where.tenantId === 'string'
          ? Prisma.sql`AND "tenantId" = ${where.tenantId}`
          : Prisma.sql`AND "tenantId" IN (${Prisma.join(
              (where.tenantId as { in: string[] }).in.map((id) => Prisma.sql`${id}`),
            )})`;
    const branchClause =
      where.branchId == null
        ? Prisma.empty
        : typeof where.branchId === 'string'
          ? Prisma.sql`AND "branchId" = ${where.branchId}`
          : Prisma.sql`AND "branchId" IN (${Prisma.join(
              (where.branchId as { in: string[] }).in.map((id) => Prisma.sql`${id}`),
            )})`;
    const typeClause =
      where.type == null
        ? Prisma.empty
        : Prisma.sql`AND "type" = CAST(${where.type} AS "PaymentTransactionType")`;
    const statusClause =
      where.status == null
        ? Prisma.empty
        : Prisma.sql`AND "status" = CAST(${where.status} AS "PaymentTransactionStatus")`;

    const rows = await this.prisma.$queryRaw<{ bucket: Date; total: bigint; cnt: bigint }[]>`
      SELECT date_trunc(${Prisma.raw(`'${unit}'`)}, "createdAt") AS bucket,
             COALESCE(SUM("amountCents"), 0)::bigint AS total,
             COUNT(*)::bigint AS cnt
      FROM "PaymentTransaction"
      WHERE "createdAt" >= ${scope.start}
        AND "createdAt" < ${scope.end}
        ${tenantClause}
        ${branchClause}
        ${typeClause}
        ${statusClause}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    return rows.map((r) => ({
      bucket: r.bucket.toISOString(),
      amountCents: Number(r.total),
      count: Number(r.cnt),
    }));
  }

  async tips(user: AuthUser, q: AnalyticsTipsQueryDto) {
    const scope = await this.resolve(user, q);
    const tWhere: Prisma.TipWhereInput = {
      ...this.scopeSvc.tipWhere(scope),
      ...(q.staffId ? { staffId: q.staffId } : {}),
    };

    const [byModeStatus, byStaff, byBranch, buckets] = await Promise.all([
      this.prisma.tip.groupBy({
        by: ['mode', 'status'],
        where: tWhere,
        _count: true,
        _sum: { amountCents: true },
      }),
      this.prisma.tip.groupBy({
        by: ['staffId'],
        where: tWhere,
        _count: true,
        _sum: { amountCents: true },
      }),
      this.prisma.tip.groupBy({
        by: ['branchId'],
        where: tWhere,
        _count: true,
        _sum: { amountCents: true },
      }),
      this.rawTipBuckets(scope, tWhere),
    ]);

    const cashTotal = byModeStatus
      .filter((g) => g.mode === 'CASH')
      .reduce((s, g) => s + (g._sum.amountCents ?? 0), 0);
    const digitalTotal = byModeStatus
      .filter((g) => g.mode === 'DIGITAL')
      .reduce((s, g) => s + (g._sum.amountCents ?? 0), 0);

    return {
      period: { start: scope.start.toISOString(), end: scope.end.toISOString() },
      groupBy: scope.groupBy,
      totals: {
        cashTipsCents: cashTotal,
        digitalTipsCents: digitalTotal,
      },
      byModeAndStatus: byModeStatus.map((g) => ({
        mode: g.mode,
        status: g.status,
        count: g._count,
        amountCents: g._sum.amountCents ?? 0,
      })),
      byStaff: byStaff.map((g) => ({
        staffId: g.staffId,
        count: g._count,
        amountCents: g._sum.amountCents ?? 0,
      })),
      byBranch: byBranch.map((g) => ({
        branchId: g.branchId,
        count: g._count,
        amountCents: g._sum.amountCents ?? 0,
      })),
      trend: buckets,
    };
  }

  private async rawTipBuckets(scope: ResolvedAnalyticsScope, where: Prisma.TipWhereInput) {
    const unit = scope.groupBy;
    const tenantClause =
      where.tenantId == null
        ? Prisma.empty
        : typeof where.tenantId === 'string'
          ? Prisma.sql`AND "tenantId" = ${where.tenantId}`
          : Prisma.sql`AND "tenantId" IN (${Prisma.join(
              (where.tenantId as { in: string[] }).in.map((id) => Prisma.sql`${id}`),
            )})`;
    const branchClause =
      where.branchId == null
        ? Prisma.empty
        : typeof where.branchId === 'string'
          ? Prisma.sql`AND "branchId" = ${where.branchId}`
          : Prisma.sql`AND "branchId" IN (${Prisma.join(
              (where.branchId as { in: string[] }).in.map((id) => Prisma.sql`${id}`),
            )})`;
    const staffClause =
      where.staffId == null ? Prisma.empty : Prisma.sql`AND "staffId" = ${where.staffId}`;

    const rows = await this.prisma.$queryRaw<{ bucket: Date; total: bigint; cnt: bigint }[]>`
      SELECT date_trunc(${Prisma.raw(`'${unit}'`)}, "createdAt") AS bucket,
             COALESCE(SUM("amountCents"), 0)::bigint AS total,
             COUNT(*)::bigint AS cnt
      FROM "Tip"
      WHERE "createdAt" >= ${scope.start}
        AND "createdAt" < ${scope.end}
        ${tenantClause}
        ${branchClause}
        ${staffClause}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    return rows.map((r) => ({
      bucket: r.bucket.toISOString(),
      amountCents: Number(r.total),
      count: Number(r.cnt),
    }));
  }

  async ratings(user: AuthUser, q: AnalyticsRatingsQueryDto) {
    const scope = await this.resolve(user, q);
    const rWhere = this.scopeSvc.ratingWhere(scope);
    const lowMax = q.lowScoreMax ?? 2;

    const [overall, byTarget, byStaff, trend, lowAlerts] = await Promise.all([
      this.prisma.rating.aggregate({
        where: rWhere,
        _avg: { score: true },
        _count: true,
      }),
      this.prisma.rating.groupBy({
        by: ['targetType'],
        where: rWhere,
        _avg: { score: true },
        _count: true,
      }),
      this.prisma.rating.groupBy({
        by: ['staffId'],
        where: { ...rWhere, staffId: { not: null } },
        _avg: { score: true },
        _count: true,
      }),
      this.rawRatingBuckets(scope, rWhere),
      this.prisma.rating.count({
        where: { ...rWhere, score: { lte: lowMax } },
      }),
    ]);

    return {
      period: { start: scope.start.toISOString(), end: scope.end.toISOString() },
      groupBy: scope.groupBy,
      overall: {
        averageScore: overall._avg.score,
        count: overall._count,
      },
      byTargetType: byTarget.map((g) => ({
        targetType: g.targetType,
        averageScore: g._avg.score,
        count: g._count,
      })),
      byStaff: byStaff.map((g) => ({
        staffId: g.staffId,
        averageScore: g._avg.score,
        count: g._count,
      })),
      trend,
      lowRatingAlerts: {
        thresholdMaxScore: lowMax,
        count: lowAlerts,
      },
    };
  }

  private async rawRatingBuckets(
    scope: ResolvedAnalyticsScope,
    where: Prisma.RatingWhereInput,
  ) {
    const unit = scope.groupBy;
    const tenantClause =
      where.tenantId == null
        ? Prisma.empty
        : typeof where.tenantId === 'string'
          ? Prisma.sql`AND "tenantId" = ${where.tenantId}`
          : Prisma.sql`AND "tenantId" IN (${Prisma.join(
              (where.tenantId as { in: string[] }).in.map((id) => Prisma.sql`${id}`),
            )})`;
    const branchClause =
      where.branchId == null
        ? Prisma.empty
        : typeof where.branchId === 'string'
          ? Prisma.sql`AND "branchId" = ${where.branchId}`
          : Prisma.sql`AND "branchId" IN (${Prisma.join(
              (where.branchId as { in: string[] }).in.map((id) => Prisma.sql`${id}`),
            )})`;

    const rows = await this.prisma.$queryRaw<{ bucket: Date; avg: number | null; cnt: bigint }[]>`
      SELECT date_trunc(${Prisma.raw(`'${unit}'`)}, "createdAt") AS bucket,
             AVG("score")::float AS avg,
             COUNT(*)::bigint AS cnt
      FROM "Rating"
      WHERE "deletedAt" IS NULL
        AND "createdAt" >= ${scope.start}
        AND "createdAt" < ${scope.end}
        ${tenantClause}
        ${branchClause}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    return rows.map((r) => ({
      bucket: r.bucket.toISOString(),
      averageScore: r.avg,
      count: Number(r.cnt),
    }));
  }

  async operations(user: AuthUser, q: AnalyticsQueryDto) {
    const scope = await this.resolve(user, q);
    const tenantFilter =
      scope.tenantIds == null
        ? {}
        : scope.tenantIds.length === 1
          ? { tenantId: scope.tenantIds[0] }
          : { tenantId: { in: scope.tenantIds } };
    const branchFilter =
      scope.branchIds == null
        ? {}
        : scope.branchIds.length === 1
          ? { branchId: scope.branchIds[0] }
          : { branchId: { in: scope.branchIds } };
    const dateFilter = { gte: scope.start, lt: scope.end };
    const base = { ...tenantFilter, ...branchFilter, createdAt: dateFilter };

    const [
      waiterByStatus,
      billByStatus,
      assistByStatus,
      diningByStatus,
      waiterTrend,
      billTrend,
      assistTrend,
    ] = await Promise.all([
      this.prisma.waiterCallRequest.groupBy({
        by: ['status'],
        where: base,
        _count: true,
      }),
      this.prisma.billRequest.groupBy({
        by: ['status'],
        where: base,
        _count: true,
      }),
      this.prisma.assistanceRequest.groupBy({
        by: ['status'],
        where: base,
        _count: true,
      }),
      this.prisma.diningCustomerServiceRequest.groupBy({
        by: ['status'],
        where: base,
        _count: true,
      }),
      this.operationsTrend('WaiterCallRequest', scope, tenantFilter, branchFilter),
      this.operationsTrend('BillRequest', scope, tenantFilter, branchFilter),
      this.operationsTrend('AssistanceRequest', scope, tenantFilter, branchFilter),
    ]);

    return {
      period: { start: scope.start.toISOString(), end: scope.end.toISOString() },
      groupBy: scope.groupBy,
      waiterCalls: {
        total: waiterByStatus.reduce((s, g) => s + g._count, 0),
        byStatus: waiterByStatus.map((g) => ({ status: g.status, count: g._count })),
        trend: waiterTrend,
      },
      billRequests: {
        total: billByStatus.reduce((s, g) => s + g._count, 0),
        byStatus: billByStatus.map((g) => ({ status: g.status, count: g._count })),
        trend: billTrend,
      },
      assistanceRequests: {
        total: assistByStatus.reduce((s, g) => s + g._count, 0),
        byStatus: assistByStatus.map((g) => ({ status: g.status, count: g._count })),
        trend: assistTrend,
      },
      diningCustomerService: {
        total: diningByStatus.reduce((s, g) => s + g._count, 0),
        byStatus: diningByStatus.map((g) => ({ status: g.status, count: g._count })),
      },
    };
  }

  private async operationsTrend(
    table: 'WaiterCallRequest' | 'BillRequest' | 'AssistanceRequest',
    scope: ResolvedAnalyticsScope,
    tenantFilter: Record<string, unknown>,
    branchFilter: Record<string, unknown>,
  ) {
    const tid = tenantFilter as { tenantId?: string | { in: string[] } };
    const bid = branchFilter as { branchId?: string | { in: string[] } };
    const tenantClause =
      tid.tenantId == null
        ? Prisma.empty
        : typeof tid.tenantId === 'string'
          ? Prisma.sql`AND "tenantId" = ${tid.tenantId}`
          : Prisma.sql`AND "tenantId" IN (${Prisma.join(
              tid.tenantId.in.map((id) => Prisma.sql`${id}`),
            )})`;
    const branchClause =
      bid.branchId == null
        ? Prisma.empty
        : typeof bid.branchId === 'string'
          ? Prisma.sql`AND "branchId" = ${bid.branchId}`
          : Prisma.sql`AND "branchId" IN (${Prisma.join(
              bid.branchId.in.map((id) => Prisma.sql`${id}`),
            )})`;
    return this.rawCountBucketsSafe(table, scope, tenantClause, branchClause, scope.groupBy);
  }

  private async rawCountBucketsSafe(
    table: 'WaiterCallRequest' | 'BillRequest' | 'AssistanceRequest',
    scope: ResolvedAnalyticsScope,
    tenantClause: Prisma.Sql,
    branchClause: Prisma.Sql,
    unit: GroupByPeriod,
  ) {
    const rows = await this.prisma.$queryRaw<{ bucket: Date; cnt: bigint }[]>`
      SELECT date_trunc(${Prisma.raw(`'${unit}'`)}, "createdAt") AS bucket,
             COUNT(*)::bigint AS cnt
      FROM ${Prisma.raw(`"${table}"`)}
      WHERE "createdAt" >= ${scope.start}
        AND "createdAt" < ${scope.end}
        ${tenantClause}
        ${branchClause}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    return rows.map((r) => ({
      bucket: r.bucket.toISOString(),
      count: Number(r.cnt),
    }));
  }

  async foodDining(user: AuthUser, q: AnalyticsQueryDto) {
    const scope = await this.resolve(user, q);
    const tenantIds = scope.tenantIds;
    if (scope.allTenants) {
      const cats = await this.prisma.tenantCategory.findMany({
        where: { category: 'FOOD_DINING', enabled: true },
        select: { tenantId: true },
      });
      const tids = [...new Set(cats.map((c) => c.tenantId))];
      return this.foodDiningForTenants(scope, tids);
    }
    if (!tenantIds?.length) {
      return { enabled: false, summary: {} };
    }
    const enabled = await this.prisma.tenantCategory.findMany({
      where: { tenantId: { in: tenantIds }, category: 'FOOD_DINING', enabled: true },
    });
    if (enabled.length === 0) {
      return { enabled: false, tenantIds, summary: {} };
    }
    return this.foodDiningForTenants(scope, tenantIds);
  }

  private async foodDiningForTenants(scope: ResolvedAnalyticsScope, tenantIds: string[]) {
    const tf =
      tenantIds.length === 1 ? { tenantId: tenantIds[0] } : { tenantId: { in: tenantIds } };
    const bf =
      scope.branchIds == null
        ? {}
        : scope.branchIds.length === 1
          ? { branchId: scope.branchIds[0] }
          : { branchId: { in: scope.branchIds } };
    const df = { createdAt: { gte: scope.start, lt: scope.end } };

    const sessionsWhere: Prisma.ConversationSessionWhereInput = {
      deletedAt: null,
      createdAt: df.createdAt,
      ...(typeof tf.tenantId === 'string'
        ? { tenantId: tf.tenantId }
        : { tenantId: { in: tf.tenantId.in } }),
    };
    if ('branchId' in bf && bf.branchId) {
      sessionsWhere.branchId =
        typeof bf.branchId === 'string' ? bf.branchId : { in: bf.branchId.in };
    }

    const [tables, menuItems, sessions, waiter, bills, dining] = await Promise.all([
      this.prisma.diningTable.count({ where: { ...tf, ...bf, deletedAt: null } }),
      this.prisma.diningMenuItem.count({ where: { ...tf, ...bf, deletedAt: null } }),
      this.prisma.conversationSession.count({ where: sessionsWhere }),
      this.prisma.waiterCallRequest.count({ where: { ...tf, ...bf, ...df } }),
      this.prisma.billRequest.count({ where: { ...tf, ...bf, ...df } }),
      this.prisma.diningCustomerServiceRequest.count({ where: { ...tf, ...bf, ...df } }),
    ]);

    return {
      enabled: true,
      tenantIds,
      period: { start: scope.start.toISOString(), end: scope.end.toISOString() },
      summary: {
        diningTables: tables,
        menuItems,
        conversationSessions: sessions,
        waiterCallsInPeriod: waiter,
        billRequestsInPeriod: bills,
        diningSupportInPeriod: dining,
      },
    };
  }

  async beautyGrooming(user: AuthUser, q: AnalyticsQueryDto) {
    const scope = await this.resolve(user, q);
    if (scope.allTenants) {
      const cats = await this.prisma.tenantCategory.findMany({
        where: { category: 'BEAUTY_GROOMING', enabled: true },
        select: { tenantId: true },
      });
      const tids = [...new Set(cats.map((c) => c.tenantId))];
      return this.beautyForTenants(scope, tids);
    }
    const tenantIds = scope.tenantIds;
    if (!tenantIds?.length) {
      return { enabled: false, summary: {} };
    }
    const enabled = await this.prisma.tenantCategory.findMany({
      where: { tenantId: { in: tenantIds }, category: 'BEAUTY_GROOMING', enabled: true },
    });
    if (enabled.length === 0) {
      return { enabled: false, tenantIds, summary: {} };
    }
    return this.beautyForTenants(scope, tenantIds);
  }

  private async beautyForTenants(scope: ResolvedAnalyticsScope, tenantIds: string[]) {
    const tf =
      tenantIds.length === 1 ? { tenantId: tenantIds[0] } : { tenantId: { in: tenantIds } };
    const bf =
      scope.branchIds == null
        ? {}
        : scope.branchIds.length === 1
          ? { branchId: scope.branchIds[0] }
          : { branchId: { in: scope.branchIds } };
    const df = { createdAt: { gte: scope.start, lt: scope.end } };

    const beautySessionsWhere: Prisma.ConversationSessionWhereInput = {
      deletedAt: null,
      createdAt: df.createdAt,
      ...(typeof tf.tenantId === 'string'
        ? { tenantId: tf.tenantId }
        : { tenantId: { in: tf.tenantId.in } }),
    };
    if ('branchId' in bf && bf.branchId) {
      beautySessionsWhere.branchId =
        typeof bf.branchId === 'string' ? bf.branchId : { in: bf.branchId.in };
    }

    const [stations, services, assistance, sessions] = await Promise.all([
      this.prisma.beautyStation.count({ where: { ...tf, ...bf, deletedAt: null } }),
      this.prisma.beautyService.count({ where: { ...tf, ...bf, deletedAt: null } }),
      this.prisma.assistanceRequest.count({ where: { ...tf, ...bf, ...df } }),
      this.prisma.conversationSession.count({ where: beautySessionsWhere }),
    ]);

    return {
      enabled: true,
      tenantIds,
      period: { start: scope.start.toISOString(), end: scope.end.toISOString() },
      summary: {
        beautyStations: stations,
        beautyServices: services,
        assistanceRequestsInPeriod: assistance,
        conversationSessionsInPeriod: sessions,
      },
    };
  }
}
