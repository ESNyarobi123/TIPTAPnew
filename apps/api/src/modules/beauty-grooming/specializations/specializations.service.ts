import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditService } from '../../audit-logs/audit.service';
import type { AuthUser } from '../../auth/types/request-user.type';
import { BeautyGroomingAccessService } from '../beauty-grooming-access.service';
import type { BeautyGroomingRequestMeta } from '../service-categories/service-categories.service';
import type { CreateSpecializationDto } from './dto/create-specialization.dto';
import type { PatchSpecializationDto } from './dto/patch-specialization.dto';

@Injectable()
export class SpecializationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly beautyAccess: BeautyGroomingAccessService,
    private readonly audit: AuditService,
  ) {}

  private async validateOptionalLinks(
    tenantId: string,
    categoryId: string | null | undefined,
    serviceId: string | null | undefined,
  ) {
    if (categoryId) {
      const c = await this.prisma.beautyServiceCategory.findFirst({
        where: { id: categoryId, tenantId, deletedAt: null },
      });
      if (!c) {
        throw new BadRequestException('beautyServiceCategoryId not found for tenant');
      }
    }
    if (serviceId) {
      const s = await this.prisma.beautyService.findFirst({
        where: { id: serviceId, tenantId, deletedAt: null },
      });
      if (!s) {
        throw new BadRequestException('beautyServiceId not found for tenant');
      }
    }
  }

  async create(actor: AuthUser, dto: CreateSpecializationDto, meta: BeautyGroomingRequestMeta) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: dto.staffId, tenantId: dto.tenantId, deletedAt: null },
    });
    if (!staff) {
      throw new BadRequestException('staffId not found for tenant');
    }
    await this.beautyAccess.assertCanManageCatalogRow(actor, dto.tenantId, staff.branchId ?? null);

    await this.validateOptionalLinks(
      dto.tenantId,
      dto.beautyServiceCategoryId,
      dto.beautyServiceId,
    );

    const row = await this.prisma.providerSpecialization.create({
      data: {
        staffId: dto.staffId,
        title: dto.title.trim(),
        description: dto.description?.trim(),
        beautyServiceCategoryId: dto.beautyServiceCategoryId ?? null,
        beautyServiceId: dto.beautyServiceId ?? null,
      },
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'ProviderSpecialization',
      entityId: row.id,
      tenantId: dto.tenantId,
      branchId: staff.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Provider specialization created',
      details: { staffId: row.staffId, title: row.title },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return row;
  }

  async findAll(actor: AuthUser, tenantId: string, staffId?: string) {
    await this.beautyAccess.assertReadableTenantBeauty(actor, tenantId);
    return this.prisma.providerSpecialization.findMany({
      where: {
        staff: { tenantId, deletedAt: null },
        ...(staffId?.trim() ? { staffId: staffId.trim() } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const row = await this.prisma.providerSpecialization.findFirst({
      where: { id },
      include: { staff: true },
    });
    if (!row) {
      throw new NotFoundException('Specialization not found');
    }
    await this.beautyAccess.assertReadableTenantBeauty(actor, row.staff.tenantId);
    return row;
  }

  async patch(actor: AuthUser, id: string, dto: PatchSpecializationDto, meta: BeautyGroomingRequestMeta) {
    const row = await this.prisma.providerSpecialization.findFirst({
      where: { id },
      include: { staff: true },
    });
    if (!row) {
      throw new NotFoundException('Specialization not found');
    }
    await this.beautyAccess.assertCanManageCatalogRow(actor, row.staff.tenantId, row.staff.branchId ?? null);

    const tenantId = row.staff.tenantId;
    await this.validateOptionalLinks(
      tenantId,
      dto.beautyServiceCategoryId === undefined ? undefined : dto.beautyServiceCategoryId,
      dto.beautyServiceId === undefined ? undefined : dto.beautyServiceId,
    );

    const updated = await this.prisma.providerSpecialization.update({
      where: { id },
      data: {
        ...(dto.title != null ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description === null ? null : dto.description.trim() }
          : {}),
        ...(dto.beautyServiceCategoryId !== undefined
          ? { beautyServiceCategoryId: dto.beautyServiceCategoryId }
          : {}),
        ...(dto.beautyServiceId !== undefined ? { beautyServiceId: dto.beautyServiceId } : {}),
      },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'ProviderSpecialization',
      entityId: id,
      tenantId,
      branchId: row.staff.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Provider specialization updated',
      changes: dto as object,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }
}
