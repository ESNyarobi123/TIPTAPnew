import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditService } from '../../audit-logs/audit.service';
import type { AuthUser } from '../../auth/types/request-user.type';
import { TenantAccessService } from '../../tenants/tenant-access.service';
import { BeautyGroomingAccessService } from '../beauty-grooming-access.service';
import type { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import type { PatchServiceCategoryDto } from './dto/patch-service-category.dto';

export type BeautyGroomingRequestMeta = {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class ServiceCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly beautyAccess: BeautyGroomingAccessService,
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

  async create(actor: AuthUser, dto: CreateServiceCategoryDto, meta: BeautyGroomingRequestMeta) {
    const branchId = dto.branchId?.trim() || null;
    await this.beautyAccess.assertCanManageCatalogRow(actor, dto.tenantId, branchId);
    if (branchId) {
      await this.access.assertBranchBelongsToTenant(branchId, dto.tenantId);
    }

    const row = await this.prisma.beautyServiceCategory.create({
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
      entityType: 'BeautyServiceCategory',
      entityId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Beauty service category created',
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
    await this.beautyAccess.assertReadableTenantBeauty(actor, tenantId);
    const bf = this.branchScopeFilter(branchId);
    return this.prisma.beautyServiceCategory.findMany({
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
    const row = await this.prisma.beautyServiceCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Service category not found');
    }
    await this.beautyAccess.assertReadableTenantBeauty(actor, row.tenantId);
    return row;
  }

  async patch(actor: AuthUser, id: string, dto: PatchServiceCategoryDto, meta: BeautyGroomingRequestMeta) {
    const row = await this.prisma.beautyServiceCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Service category not found');
    }
    await this.beautyAccess.assertCanManageCatalogRow(actor, row.tenantId, row.branchId);

    const updated = await this.prisma.beautyServiceCategory.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.sortOrder != null ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive != null ? { isActive: dto.isActive } : {}),
      },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'BeautyServiceCategory',
      entityId: id,
      tenantId: updated.tenantId,
      branchId: updated.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Beauty service category updated',
      changes: dto as object,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }
}
