import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { AuthUser } from '../auth/types/request-user.type';
import { userHasRole, userIsSuperAdmin } from '../auth/types/request-user.type';
import { AnalyticsScopeService } from '../analytics/analytics-scope.service';
import { TenantAccessService } from '../tenants/tenant-access.service';
import type { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Injectable()
export class AuditLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
    private readonly analyticsScope: AnalyticsScopeService,
  ) {}

  private async buildWhere(
    user: AuthUser,
    q: AuditLogQueryDto,
  ): Promise<Prisma.AuditLogWhereInput> {
    const { start, end } = this.analyticsScope.parseDates(q.startDate, q.endDate);
    const where: Prisma.AuditLogWhereInput = {
      createdAt: { gte: start, lt: end },
    };

    if (q.action) {
      where.action = q.action;
    }
    if (q.entityType) {
      where.entityType = q.entityType;
    }
    if (q.entityId) {
      where.entityId = q.entityId;
    }
    if (q.correlationId) {
      where.correlationId = q.correlationId;
    }
    if (q.actorType) {
      where.actorType = q.actorType;
    }
    if (q.actorId) {
      where.actorUserId = q.actorId;
    }

    if (userIsSuperAdmin(user)) {
      if (q.tenantId) {
        await this.access.assertReadableTenant(user, q.tenantId);
        where.tenantId = q.tenantId;
      }
      if (q.branchId) {
        await this.access.assertReadableBranch(user, q.branchId);
        where.branchId = q.branchId;
      }
      return where;
    }

    const owned = this.access.getOwnerTenantIds(user);
    const managed = this.access.getManagedBranchIds(user);
    let tenantId = q.tenantId;
    if (!tenantId && owned.length === 1) {
      tenantId = owned[0];
    }
    if (!tenantId && userHasRole(user, 'BRANCH_MANAGER')) {
      const branches = await this.prisma.branch.findMany({
        where: { id: { in: managed }, deletedAt: null },
        select: { tenantId: true },
      });
      const tids = [...new Set(branches.map((b) => b.tenantId))];
      if (tids.length === 1) {
        tenantId = tids[0];
      }
    }
    if (!tenantId) {
      throw new ForbiddenException('tenantId is required for audit log access');
    }
    await this.access.assertReadableTenant(user, tenantId);
    where.tenantId = tenantId;

    if (q.branchId) {
      await this.access.assertReadableBranch(user, q.branchId);
      if (!owned.includes(tenantId)) {
        const b = await this.prisma.branch.findFirst({
          where: { id: q.branchId, tenantId, deletedAt: null },
        });
        if (!b || !managed.includes(b.id)) {
          throw new ForbiddenException('No access to this branch');
        }
      }
      where.branchId = q.branchId;
    } else if (userHasRole(user, 'BRANCH_MANAGER') && !owned.includes(tenantId)) {
      where.OR = [{ branchId: { in: managed } }, { branchId: null }];
    }

    return where;
  }

  async list(user: AuthUser, q: AuditLogQueryDto) {
    const where = await this.buildWhere(user, q);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 50;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { page, pageSize, total, items };
  }

  async getOne(user: AuthUser, id: string) {
    const row = await this.prisma.auditLog.findFirst({ where: { id } });
    if (!row) {
      throw new NotFoundException('Audit log not found');
    }
    if (userIsSuperAdmin(user)) {
      return row;
    }
    if (row.tenantId) {
      await this.access.assertReadableTenant(user, row.tenantId);
      const owned = this.access.getOwnerTenantIds(user);
      if (!owned.includes(row.tenantId)) {
        const managed = this.access.getManagedBranchIds(user);
        if (row.branchId && !managed.includes(row.branchId)) {
          throw new ForbiddenException('No access to this audit entry');
        }
        if (!row.branchId) {
          // tenant-level log: allow BM (same tenant)
        }
      }
    } else {
      throw new ForbiddenException('No access to this audit entry');
    }
    return row;
  }
}
