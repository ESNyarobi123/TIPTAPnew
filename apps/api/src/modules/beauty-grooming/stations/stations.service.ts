import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditService } from '../../audit-logs/audit.service';
import type { AuthUser } from '../../auth/types/request-user.type';
import { TenantAccessService } from '../../tenants/tenant-access.service';
import { BeautyGroomingAccessService } from '../beauty-grooming-access.service';
import type { BeautyGroomingRequestMeta } from '../service-categories/service-categories.service';
import type { CreateBeautyStationDto } from './dto/create-beauty-station.dto';
import type { PatchBeautyStationDto } from './dto/patch-beauty-station.dto';

@Injectable()
export class StationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly beautyAccess: BeautyGroomingAccessService,
    private readonly access: TenantAccessService,
    private readonly audit: AuditService,
  ) {}

  async create(actor: AuthUser, dto: CreateBeautyStationDto, meta: BeautyGroomingRequestMeta) {
    await this.beautyAccess.assertCanManageBranchRow(actor, dto.tenantId, dto.branchId);
    await this.access.assertBranchBelongsToTenant(dto.branchId, dto.tenantId);

    const code = dto.code.trim();
    const dup = await this.prisma.beautyStation.findFirst({
      where: {
        tenantId: dto.tenantId,
        branchId: dto.branchId,
        code,
        deletedAt: null,
      },
    });
    if (dup) {
      throw new BadRequestException('Station code already in use for this branch');
    }

    const row = await this.prisma.beautyStation.create({
      data: {
        tenantId: dto.tenantId,
        branchId: dto.branchId,
        code,
        label: dto.label?.trim(),
        status: dto.status ?? 'AVAILABLE',
        notes: dto.notes?.trim(),
        isActive: dto.isActive ?? true,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'BeautyStation',
      entityId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Beauty station created',
      details: { code: row.code },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return row;
  }

  async findAll(actor: AuthUser, tenantId: string, branchId?: string) {
    await this.beautyAccess.assertReadableTenantBeauty(actor, tenantId);
    return this.prisma.beautyStation.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(branchId?.trim() ? { branchId: branchId.trim() } : {}),
      },
      orderBy: [{ code: 'asc' }],
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const row = await this.prisma.beautyStation.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Station not found');
    }
    await this.beautyAccess.assertReadableTenantBeauty(actor, row.tenantId);
    return row;
  }

  async patch(actor: AuthUser, id: string, dto: PatchBeautyStationDto, meta: BeautyGroomingRequestMeta) {
    const row = await this.prisma.beautyStation.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Station not found');
    }
    await this.beautyAccess.assertCanManageBranchRow(actor, row.tenantId, row.branchId);

    if (dto.code && dto.code.trim() !== row.code) {
      const dup = await this.prisma.beautyStation.findFirst({
        where: {
          tenantId: row.tenantId,
          branchId: row.branchId,
          code: dto.code.trim(),
          deletedAt: null,
          NOT: { id },
        },
      });
      if (dup) {
        throw new BadRequestException('Station code already in use for this branch');
      }
    }

    const updated = await this.prisma.beautyStation.update({
      where: { id },
      data: {
        ...(dto.code != null ? { code: dto.code.trim() } : {}),
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.status != null ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.isActive != null ? { isActive: dto.isActive } : {}),
        ...(dto.metadata !== undefined
          ? { metadata: dto.metadata as Prisma.InputJsonValue | undefined }
          : {}),
      },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'BeautyStation',
      entityId: id,
      tenantId: updated.tenantId,
      branchId: updated.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Beauty station updated',
      changes: dto as object,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }
}
