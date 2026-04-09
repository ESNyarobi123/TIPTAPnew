import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditService } from '../../audit-logs/audit.service';
import type { AuthUser } from '../../auth/types/request-user.type';
import { TenantAccessService } from '../../tenants/tenant-access.service';
import { FoodDiningAccessService } from '../food-dining-access.service';
import type { CreateDiningTableDto } from './dto/create-dining-table.dto';
import type { PatchDiningTableDto } from './dto/patch-dining-table.dto';
import type { FoodDiningRequestMeta } from '../menu-categories/menu-categories.service';

@Injectable()
export class TablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly foodAccess: FoodDiningAccessService,
    private readonly access: TenantAccessService,
    private readonly audit: AuditService,
  ) {}

  async create(actor: AuthUser, dto: CreateDiningTableDto, meta: FoodDiningRequestMeta) {
    await this.foodAccess.assertCanManageBranchRow(actor, dto.tenantId, dto.branchId);
    await this.access.assertBranchBelongsToTenant(dto.branchId, dto.tenantId);

    const code = dto.code.trim();
    const dup = await this.prisma.diningTable.findFirst({
      where: {
        tenantId: dto.tenantId,
        branchId: dto.branchId,
        code,
        deletedAt: null,
      },
    });
    if (dup) {
      throw new BadRequestException('Table code already in use for this branch');
    }

    const row = await this.prisma.diningTable.create({
      data: {
        tenantId: dto.tenantId,
        branchId: dto.branchId,
        code,
        label: dto.label?.trim(),
        capacity: dto.capacity ?? null,
        status: dto.status ?? 'AVAILABLE',
        isActive: dto.isActive ?? true,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'DiningTable',
      entityId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Dining table created',
      details: { code: row.code },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return row;
  }

  async findAll(actor: AuthUser, tenantId: string, branchId?: string) {
    await this.foodAccess.assertReadableTenantFood(actor, tenantId);
    return this.prisma.diningTable.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(branchId?.trim() ? { branchId: branchId.trim() } : {}),
      },
      orderBy: [{ code: 'asc' }],
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const row = await this.prisma.diningTable.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Table not found');
    }
    await this.foodAccess.assertReadableTenantFood(actor, row.tenantId);
    return row;
  }

  async patch(actor: AuthUser, id: string, dto: PatchDiningTableDto, meta: FoodDiningRequestMeta) {
    const row = await this.prisma.diningTable.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Table not found');
    }
    await this.foodAccess.assertCanManageBranchRow(actor, row.tenantId, row.branchId);

    if (dto.code && dto.code.trim() !== row.code) {
      const dup = await this.prisma.diningTable.findFirst({
        where: {
          tenantId: row.tenantId,
          branchId: row.branchId,
          code: dto.code.trim(),
          deletedAt: null,
          NOT: { id },
        },
      });
      if (dup) {
        throw new BadRequestException('Table code already in use for this branch');
      }
    }

    const updated = await this.prisma.diningTable.update({
      where: { id },
      data: {
        ...(dto.code != null ? { code: dto.code.trim() } : {}),
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.status != null ? { status: dto.status } : {}),
        ...(dto.isActive != null ? { isActive: dto.isActive } : {}),
        ...(dto.metadata !== undefined
          ? { metadata: dto.metadata as Prisma.InputJsonValue | undefined }
          : {}),
      },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'DiningTable',
      entityId: id,
      tenantId: updated.tenantId,
      branchId: updated.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Dining table updated',
      changes: dto as object,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }
}
