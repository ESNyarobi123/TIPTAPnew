import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AssistanceRequestStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditService } from '../../audit-logs/audit.service';
import type { AuthUser } from '../../auth/types/request-user.type';
import { TenantAccessService } from '../../tenants/tenant-access.service';
import { BeautyGroomingAccessService } from '../beauty-grooming-access.service';
import type { BeautyGroomingRequestMeta } from '../service-categories/service-categories.service';
import type { CreateAssistanceRequestDto } from './dto/create-assistance-request.dto';
import type { PatchAssistanceRequestDto } from './dto/patch-assistance-request.dto';

export type BeautyAssistanceSupportKind = 'RECEPTION' | 'CUSTOMER_SUPPORT';

@Injectable()
export class AssistanceRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly beautyAccess: BeautyGroomingAccessService,
    private readonly access: TenantAccessService,
    private readonly audit: AuditService,
  ) {}

  private async validateStation(tenantId: string, branchId: string, stationId: string) {
    const s = await this.prisma.beautyStation.findFirst({
      where: { id: stationId, tenantId, branchId, deletedAt: null },
    });
    if (!s) {
      throw new BadRequestException('stationId not found for tenant/branch');
    }
  }

  private async validateStaff(tenantId: string, staffId: string) {
    const st = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId, deletedAt: null },
    });
    if (!st) {
      throw new BadRequestException('staffId not found for tenant');
    }
  }

  async create(actor: AuthUser, dto: CreateAssistanceRequestDto, meta: BeautyGroomingRequestMeta) {
    await this.beautyAccess.assertCanManageBranchRow(actor, dto.tenantId, dto.branchId);
    await this.access.assertBranchBelongsToTenant(dto.branchId, dto.tenantId);
    if (dto.stationId) {
      await this.validateStation(dto.tenantId, dto.branchId, dto.stationId);
    }
    if (dto.staffId) {
      await this.validateStaff(dto.tenantId, dto.staffId);
    }

    const row = await this.prisma.assistanceRequest.create({
      data: {
        tenantId: dto.tenantId,
        branchId: dto.branchId,
        stationId: dto.stationId ?? null,
        sessionId: dto.sessionId ?? null,
        staffId: dto.staffId ?? null,
        notes: dto.notes?.trim(),
        status: 'PENDING',
      },
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'AssistanceRequest',
      entityId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Assistance request created',
      details: { status: row.status, stationId: row.stationId, sessionId: row.sessionId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return row;
  }

  async createFromSession(
    params: {
      tenantId: string;
      branchId: string;
      sessionId: string;
      stationId?: string | null;
      staffId?: string | null;
      supportKind: BeautyAssistanceSupportKind;
    },
    meta: BeautyGroomingRequestMeta,
  ) {
    await this.access.assertBranchBelongsToTenant(params.branchId, params.tenantId);
    if (params.stationId) {
      await this.validateStation(params.tenantId, params.branchId, params.stationId);
    }
    if (params.staffId) {
      await this.validateStaff(params.tenantId, params.staffId);
    }

    const prefix =
      params.supportKind === 'RECEPTION' ? '[RECEPTION]' : '[CUSTOMER_SUPPORT]';
    const notes = `${prefix} From conversation session`;

    const row = await this.prisma.assistanceRequest.create({
      data: {
        tenantId: params.tenantId,
        branchId: params.branchId,
        stationId: params.stationId ?? null,
        sessionId: params.sessionId,
        staffId: params.staffId ?? null,
        notes,
        status: 'PENDING',
      },
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'AssistanceRequest',
      entityId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      actorType: 'CONVERSATION_SESSION',
      correlationId: meta.correlationId,
      summary: 'Assistance request from customer session',
      details: {
        sessionId: params.sessionId,
        stationId: row.stationId,
        staffId: row.staffId,
        supportKind: params.supportKind,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return row;
  }

  async findAll(actor: AuthUser, tenantId: string, branchId?: string, status?: AssistanceRequestStatus) {
    await this.beautyAccess.assertReadableTenantBeauty(actor, tenantId);
    return this.prisma.assistanceRequest.findMany({
      where: {
        tenantId,
        ...(branchId?.trim() ? { branchId: branchId.trim() } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const row = await this.prisma.assistanceRequest.findFirst({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException('Assistance request not found');
    }
    await this.beautyAccess.assertReadableTenantBeauty(actor, row.tenantId);
    return row;
  }

  async patch(actor: AuthUser, id: string, dto: PatchAssistanceRequestDto, meta: BeautyGroomingRequestMeta) {
    const row = await this.prisma.assistanceRequest.findFirst({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException('Assistance request not found');
    }
    await this.beautyAccess.assertCanManageBranchRow(actor, row.tenantId, row.branchId);

    const updated = await this.prisma.assistanceRequest.update({
      where: { id },
      data: {
        ...(dto.status != null ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'AssistanceRequest',
      entityId: id,
      tenantId: updated.tenantId,
      branchId: updated.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Assistance request updated',
      changes: dto as object,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }
}
