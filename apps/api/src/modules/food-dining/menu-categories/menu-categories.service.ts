import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditService } from '../../audit-logs/audit.service';
import type { AuthUser } from '../../auth/types/request-user.type';
import { TenantAccessService } from '../../tenants/tenant-access.service';
import { FoodDiningAccessService } from '../food-dining-access.service';
import type { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import type { PatchMenuCategoryDto } from './dto/patch-menu-category.dto';

export type FoodDiningRequestMeta = {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class MenuCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly foodAccess: FoodDiningAccessService,
    private readonly access: TenantAccessService,
    private readonly audit: AuditService,
  ) {}

  private branchScopeFilter(branchId: string | undefined): { OR: object[] } | Record<string, never> {
    if (!branchId?.trim()) {
      return {};
    }
    const b = branchId.trim();
    return { OR: [{ branchId: null }, { branchId: b }] };
  }

  async create(actor: AuthUser, dto: CreateMenuCategoryDto, meta: FoodDiningRequestMeta) {
    const branchId = dto.branchId?.trim() || null;
    await this.foodAccess.assertCanManageMenuRow(actor, dto.tenantId, branchId);
    if (branchId) {
      await this.access.assertBranchBelongsToTenant(branchId, dto.tenantId);
    }

    const row = await this.prisma.diningMenuCategory.create({
      data: {
        tenantId: dto.tenantId,
        branchId,
        name: dto.name.trim(),
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'DiningMenuCategory',
      entityId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Menu category created',
      details: { name: row.name },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return row;
  }

  async findAll(
    actor: AuthUser,
    tenantId: string,
    branchId?: string,
    activeOnly?: boolean,
  ) {
    await this.foodAccess.assertReadableTenantFood(actor, tenantId);
    const bf = this.branchScopeFilter(branchId);
    return this.prisma.diningMenuCategory.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...bf,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const row = await this.prisma.diningMenuCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Menu category not found');
    }
    await this.foodAccess.assertReadableTenantFood(actor, row.tenantId);
    return row;
  }

  async patch(actor: AuthUser, id: string, dto: PatchMenuCategoryDto, meta: FoodDiningRequestMeta) {
    const row = await this.prisma.diningMenuCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Menu category not found');
    }
    await this.foodAccess.assertCanManageMenuRow(actor, row.tenantId, row.branchId);

    const updated = await this.prisma.diningMenuCategory.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.sortOrder != null ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive != null ? { isActive: dto.isActive } : {}),
      },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'DiningMenuCategory',
      entityId: id,
      tenantId: updated.tenantId,
      branchId: updated.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Menu category updated',
      changes: dto as object,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }
}
