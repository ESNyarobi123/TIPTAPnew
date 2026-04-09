import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditService } from '../../audit-logs/audit.service';
import type { AuthUser } from '../../auth/types/request-user.type';
import { TenantAccessService } from '../../tenants/tenant-access.service';
import { BeautyGroomingAccessService } from '../beauty-grooming-access.service';
import type { BeautyGroomingRequestMeta } from '../service-categories/service-categories.service';
import type { CreateBeautyServiceDto } from './dto/create-beauty-service.dto';
import type { PatchBeautyServiceDto } from './dto/patch-beauty-service.dto';

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly beautyAccess: BeautyGroomingAccessService,
    private readonly access: TenantAccessService,
    private readonly audit: AuditService,
  ) {}

  private async assertCategoryInScope(
    tenantId: string,
    categoryId: string,
    itemBranchId: string | null,
  ) {
    const cat = await this.prisma.beautyServiceCategory.findFirst({
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

  async create(actor: AuthUser, dto: CreateBeautyServiceDto, meta: BeautyGroomingRequestMeta) {
    const branchId = dto.branchId?.trim() || null;
    await this.beautyAccess.assertCanManageCatalogRow(actor, dto.tenantId, branchId);
    if (branchId) {
      await this.access.assertBranchBelongsToTenant(branchId, dto.tenantId);
    }
    await this.assertCategoryInScope(dto.tenantId, dto.categoryId, branchId);

    const row = await this.prisma.beautyService.create({
      data: {
        tenantId: dto.tenantId,
        branchId,
        categoryId: dto.categoryId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        durationMin: dto.durationMinutes ?? null,
        priceCents: dto.priceCents ?? null,
        currency: dto.currency != null ? dto.currency.trim().toUpperCase() : dto.priceCents != null ? 'USD' : null,
        imageUrl: dto.imageUrl?.trim(),
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isAvailable ?? true,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'BeautyService',
      entityId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Beauty service created',
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
    await this.beautyAccess.assertReadableTenantBeauty(actor, tenantId);
    const branchPart: { OR: object[] } | Record<string, never> = opts.branchId?.trim()
      ? { OR: [{ branchId: null }, { branchId: opts.branchId.trim() }] }
      : {};
    return this.prisma.beautyService.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...branchPart,
        ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
        ...(opts.activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const row = await this.prisma.beautyService.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Beauty service not found');
    }
    await this.beautyAccess.assertReadableTenantBeauty(actor, row.tenantId);
    return row;
  }

  async patch(actor: AuthUser, id: string, dto: PatchBeautyServiceDto, meta: BeautyGroomingRequestMeta) {
    const row = await this.prisma.beautyService.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Beauty service not found');
    }
    await this.beautyAccess.assertCanManageCatalogRow(actor, row.tenantId, row.branchId);

    const nextCatId = dto.categoryId ?? row.categoryId;
    const nextBranch = row.branchId;
    if (dto.categoryId) {
      await this.assertCategoryInScope(row.tenantId, nextCatId, nextBranch);
    }

    const updated = await this.prisma.beautyService.update({
      where: { id },
      data: {
        ...(dto.categoryId != null ? { categoryId: dto.categoryId } : {}),
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description === null ? null : dto.description.trim() }
          : {}),
        ...(dto.durationMinutes !== undefined
          ? { durationMin: dto.durationMinutes === null ? null : dto.durationMinutes }
          : {}),
        ...(dto.priceCents !== undefined
          ? { priceCents: dto.priceCents === null ? null : dto.priceCents }
          : {}),
        ...(dto.currency !== undefined
          ? { currency: dto.currency === null ? null : dto.currency.trim().toUpperCase() }
          : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.displayOrder != null ? { displayOrder: dto.displayOrder } : {}),
        ...(dto.isAvailable != null ? { isActive: dto.isAvailable } : {}),
        ...(dto.metadata !== undefined
          ? { metadata: dto.metadata as Prisma.InputJsonValue | undefined }
          : {}),
      },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'BeautyService',
      entityId: id,
      tenantId: updated.tenantId,
      branchId: updated.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Beauty service updated',
      changes: dto as object,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }
}
