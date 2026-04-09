import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { AuthUser } from '../auth/types/request-user.type';
import { userHasRole, userIsSuperAdmin } from '../auth/types/request-user.type';
import { TenantAccessService } from '../tenants/tenant-access.service';

export type GroupByPeriod = 'day' | 'week' | 'month';

export type ResolvedAnalyticsScope = {
  start: Date;
  end: Date;
  groupBy: GroupByPeriod;
  /** No filter — SUPER_ADMIN platform-wide only */
  allTenants: boolean;
  tenantIds: string[] | null;
  branchIds: string[] | null;
};

@Injectable()
export class AnalyticsScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
  ) {}

  parseDates(startDate?: string, endDate?: string): { start: Date; end: Date } {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid startDate or endDate');
    }
    if (start >= end) {
      throw new BadRequestException('startDate must be before endDate');
    }
    return { start, end };
  }

  parseGroupBy(raw?: string): GroupByPeriod {
    if (!raw) {
      return 'day';
    }
    const g = raw.toLowerCase();
    if (g === 'day' || g === 'week' || g === 'month') {
      return g;
    }
    throw new BadRequestException('groupBy must be day, week, or month');
  }

  /**
   * Resolves tenant/branch filters for analytics, statements, reconciliation, and dashboards.
   */
  async resolve(
    user: AuthUser,
    tenantId: string | undefined,
    branchId: string | undefined,
    startDate?: string,
    endDate?: string,
    groupByRaw?: string,
  ): Promise<ResolvedAnalyticsScope> {
    const { start, end } = this.parseDates(startDate, endDate);
    const groupBy = this.parseGroupBy(groupByRaw);

    if (userIsSuperAdmin(user)) {
      if (tenantId) {
        await this.access.assertReadableTenant(user, tenantId);
        if (branchId) {
          await this.access.assertReadableBranch(user, branchId);
          return {
            start,
            end,
            groupBy,
            allTenants: false,
            tenantIds: [tenantId],
            branchIds: [branchId],
          };
        }
        return {
          start,
          end,
          groupBy,
          allTenants: false,
          tenantIds: [tenantId],
          branchIds: null,
        };
      }
      if (branchId) {
        throw new BadRequestException('branchId requires tenantId');
      }
      return {
        start,
        end,
        groupBy,
        allTenants: true,
        tenantIds: null,
        branchIds: null,
      };
    }

    let resolvedTenant = tenantId;
    if (!resolvedTenant) {
      const owned = this.access.getOwnerTenantIds(user);
      if (owned.length === 1) {
        resolvedTenant = owned[0];
      } else if (userHasRole(user, 'BRANCH_MANAGER')) {
        const managed = this.access.getManagedBranchIds(user);
        const branches = await this.prisma.branch.findMany({
          where: { id: { in: managed }, deletedAt: null },
          select: { tenantId: true },
        });
        const tids = [...new Set(branches.map((b) => b.tenantId))];
        if (tids.length === 1) {
          resolvedTenant = tids[0];
        }
      }
    }
    if (!resolvedTenant) {
      throw new BadRequestException('tenantId is required');
    }
    await this.access.assertReadableTenant(user, resolvedTenant);

    if (branchId) {
      await this.access.assertReadableBranch(user, branchId);
      const b = await this.prisma.branch.findFirst({
        where: { id: branchId, deletedAt: null },
      });
      if (!b || b.tenantId !== resolvedTenant) {
        throw new BadRequestException('branchId does not belong to tenantId');
      }
      return {
        start,
        end,
        groupBy,
        allTenants: false,
        tenantIds: [resolvedTenant],
        branchIds: [branchId],
      };
    }

    if (userHasRole(user, 'BRANCH_MANAGER') && !this.access.getOwnerTenantIds(user).includes(resolvedTenant)) {
      const managed = this.access.getManagedBranchIds(user);
      const inTenant = await this.prisma.branch.findMany({
        where: { tenantId: resolvedTenant, id: { in: managed }, deletedAt: null },
        select: { id: true },
      });
      if (inTenant.length === 0) {
        throw new BadRequestException('No managed branch in this tenant');
      }
      return {
        start,
        end,
        groupBy,
        allTenants: false,
        tenantIds: [resolvedTenant],
        branchIds: inTenant.map((x) => x.id),
      };
    }

    return {
      start,
      end,
      groupBy,
      allTenants: false,
      tenantIds: [resolvedTenant],
      branchIds: null,
    };
  }

  paymentWhere(scope: ResolvedAnalyticsScope): Prisma.PaymentTransactionWhereInput {
    const base: Prisma.PaymentTransactionWhereInput = {
      createdAt: { gte: scope.start, lt: scope.end },
    };
    if (scope.tenantIds?.length) {
      base.tenantId = scope.tenantIds.length === 1 ? scope.tenantIds[0] : { in: scope.tenantIds };
    }
    if (scope.branchIds?.length) {
      base.branchId =
        scope.branchIds.length === 1 ? scope.branchIds[0] : { in: scope.branchIds };
    }
    return base;
  }

  tipWhere(scope: ResolvedAnalyticsScope): Prisma.TipWhereInput {
    const base: Prisma.TipWhereInput = {
      createdAt: { gte: scope.start, lt: scope.end },
    };
    if (scope.tenantIds?.length) {
      base.tenantId = scope.tenantIds.length === 1 ? scope.tenantIds[0] : { in: scope.tenantIds };
    }
    if (scope.branchIds?.length) {
      base.branchId =
        scope.branchIds.length === 1 ? scope.branchIds[0] : { in: scope.branchIds };
    }
    return base;
  }

  ratingWhere(scope: ResolvedAnalyticsScope): Prisma.RatingWhereInput {
    const base: Prisma.RatingWhereInput = {
      deletedAt: null,
      createdAt: { gte: scope.start, lt: scope.end },
    };
    if (scope.tenantIds?.length) {
      base.tenantId = scope.tenantIds.length === 1 ? scope.tenantIds[0] : { in: scope.tenantIds };
    }
    if (scope.branchIds?.length) {
      base.branchId =
        scope.branchIds.length === 1 ? scope.branchIds[0] : { in: scope.branchIds };
    }
    return base;
  }
}
