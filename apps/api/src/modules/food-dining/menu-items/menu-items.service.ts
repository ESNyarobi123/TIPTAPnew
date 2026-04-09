import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditService } from '../../audit-logs/audit.service';
import type { AuthUser } from '../../auth/types/request-user.type';
import { TenantAccessService } from '../../tenants/tenant-access.service';
import { FoodDiningAccessService } from '../food-dining-access.service';
import type { CreateMenuItemDto } from './dto/create-menu-item.dto';
import type { PatchMenuItemDto } from './dto/patch-menu-item.dto';
import type { FoodDiningRequestMeta } from '../menu-categories/menu-categories.service';

@Injectable()
export class MenuItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly foodAccess: FoodDiningAccessService,
    private readonly access: TenantAccessService,
    private readonly audit: AuditService,
  ) {}

  private async assertCategoryInScope(
    tenantId: string,
    categoryId: string,
    itemBranchId: string | null,
  ) {
    const cat = await this.prisma.diningMenuCategory.findFirst({
      where: { id: categoryId, tenantId, deletedAt: null },
    });
    if (!cat) {
      throw new BadRequestException('categoryId not found for tenant');
    }
    if (cat.branchId) {
      if (!itemBranchId || itemBranchId !== cat.branchId) {
        throw new BadRequestException('Item branchId must match this category branch');
      }
    }
  }

  async create(actor: AuthUser, dto: CreateMenuItemDto, meta: FoodDiningRequestMeta) {
    const branchId = dto.branchId?.trim() || null;
    await this.foodAccess.assertCanManageMenuRow(actor, dto.tenantId, branchId);
    if (branchId) {
      await this.access.assertBranchBelongsToTenant(branchId, dto.tenantId);
    }
    await this.assertCategoryInScope(dto.tenantId, dto.categoryId, branchId);

    const row = await this.prisma.diningMenuItem.create({
      data: {
        tenantId: dto.tenantId,
        branchId,
        categoryId: dto.categoryId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        priceCents: dto.priceCents,
        currency: (dto.currency ?? 'USD').trim().toUpperCase(),
        imageUrl: dto.imageUrl?.trim(),
        displayOrder: dto.displayOrder ?? 0,
        isAvailable: dto.isAvailable ?? true,
        modifierSchema: dto.modifierSchema as Prisma.InputJsonValue | undefined,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'DiningMenuItem',
      entityId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Menu item created',
      details: { name: row.name, categoryId: row.categoryId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return row;
  }

  async findAll(
    actor: AuthUser,
    tenantId: string,
    opts: { branchId?: string; categoryId?: string; activeOnly?: boolean },
  ) {
    await this.foodAccess.assertReadableTenantFood(actor, tenantId);
    const branchPart: { OR: object[] } | Record<string, never> = opts.branchId?.trim()
      ? { OR: [{ branchId: null }, { branchId: opts.branchId.trim() }] }
      : {};
    return this.prisma.diningMenuItem.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...branchPart,
        ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
        ...(opts.activeOnly ? { isAvailable: true } : {}),
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const row = await this.prisma.diningMenuItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Menu item not found');
    }
    await this.foodAccess.assertReadableTenantFood(actor, row.tenantId);
    return row;
  }

  async patch(actor: AuthUser, id: string, dto: PatchMenuItemDto, meta: FoodDiningRequestMeta) {
    const row = await this.prisma.diningMenuItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Menu item not found');
    }
    await this.foodAccess.assertCanManageMenuRow(actor, row.tenantId, row.branchId);

    const nextCatId = dto.categoryId ?? row.categoryId;
    const nextBranch = row.branchId;
    if (dto.categoryId) {
      await this.assertCategoryInScope(row.tenantId, nextCatId, nextBranch);
    }

    const updated = await this.prisma.diningMenuItem.update({
      where: { id },
      data: {
        ...(dto.categoryId != null ? { categoryId: dto.categoryId } : {}),
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description === null ? null : dto.description.trim() }
          : {}),
        ...(dto.priceCents != null ? { priceCents: dto.priceCents } : {}),
        ...(dto.currency != null ? { currency: dto.currency.trim().toUpperCase() } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.displayOrder != null ? { displayOrder: dto.displayOrder } : {}),
        ...(dto.isAvailable != null ? { isAvailable: dto.isAvailable } : {}),
        ...(dto.modifierSchema !== undefined
          ? { modifierSchema: dto.modifierSchema as Prisma.InputJsonValue | undefined }
          : {}),
        ...(dto.metadata !== undefined
          ? { metadata: dto.metadata as Prisma.InputJsonValue | undefined }
          : {}),
      },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'DiningMenuItem',
      entityId: id,
      tenantId: updated.tenantId,
      branchId: updated.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Menu item updated',
      changes: dto as object,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }
}
