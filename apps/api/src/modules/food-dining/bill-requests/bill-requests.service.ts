import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { BillRequestStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditService } from '../../audit-logs/audit.service';
import type { AuthUser } from '../../auth/types/request-user.type';
import { TenantAccessService } from '../../tenants/tenant-access.service';
import { FoodDiningAccessService } from '../food-dining-access.service';
import type { CreateBillRequestDto } from './dto/create-bill-request.dto';
import type { PatchBillRequestDto } from './dto/patch-bill-request.dto';
import type { FoodDiningRequestMeta } from '../menu-categories/menu-categories.service';

@Injectable()
export class BillRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly foodAccess: FoodDiningAccessService,
    private readonly access: TenantAccessService,
    private readonly audit: AuditService,
  ) {}

  private async validateTable(tenantId: string, branchId: string, tableId: string) {
    const t = await this.prisma.diningTable.findFirst({
      where: { id: tableId, tenantId, branchId, deletedAt: null },
    });
    if (!t) {
      throw new BadRequestException('tableId not found for tenant/branch');
    }
  }

  async create(actor: AuthUser, dto: CreateBillRequestDto, meta: FoodDiningRequestMeta) {
    await this.foodAccess.assertCanManageBranchRow(actor, dto.tenantId, dto.branchId);
    await this.access.assertBranchBelongsToTenant(dto.branchId, dto.tenantId);
    if (dto.tableId) {
      await this.validateTable(dto.tenantId, dto.branchId, dto.tableId);
    }

    const row = await this.prisma.billRequest.create({
      data: {
        tenantId: dto.tenantId,
        branchId: dto.branchId,
        tableId: dto.tableId ?? null,
        sessionId: dto.sessionId ?? null,
        notes: dto.notes?.trim(),
        status: 'PENDING',
      },
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'BillRequest',
      entityId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Bill request created',
      details: { status: row.status, tableId: row.tableId, sessionId: row.sessionId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return row;
  }

  async createFromSession(
    params: {
      tenantId: string;
      branchId: string;
      tableId?: string | null;
      sessionId: string;
      notes?: string;
    },
    meta: FoodDiningRequestMeta,
  ) {
    await this.access.assertBranchBelongsToTenant(params.branchId, params.tenantId);
    if (params.tableId) {
      await this.validateTable(params.tenantId, params.branchId, params.tableId);
    }

    const row = await this.prisma.billRequest.create({
      data: {
        tenantId: params.tenantId,
        branchId: params.branchId,
        tableId: params.tableId ?? null,
        sessionId: params.sessionId,
        notes: params.notes?.trim(),
        status: 'PENDING',
      },
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'BillRequest',
      entityId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      actorType: 'CONVERSATION_SESSION',
      correlationId: meta.correlationId,
      summary: 'Bill request from customer session',
      details: { sessionId: params.sessionId, tableId: row.tableId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return row;
  }

  async findAll(actor: AuthUser, tenantId: string, branchId?: string, status?: BillRequestStatus) {
    await this.foodAccess.assertReadableTenantFood(actor, tenantId);
    return this.prisma.billRequest.findMany({
      where: {
        tenantId,
        ...(branchId?.trim() ? { branchId: branchId.trim() } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const row = await this.prisma.billRequest.findFirst({ where: { id } });
    if (!row) {
      throw new NotFoundException('Bill request not found');
    }
    await this.foodAccess.assertReadableTenantFood(actor, row.tenantId);
    return row;
  }

  async patch(actor: AuthUser, id: string, dto: PatchBillRequestDto, meta: FoodDiningRequestMeta) {
    const row = await this.prisma.billRequest.findFirst({ where: { id } });
    if (!row) {
      throw new NotFoundException('Bill request not found');
    }
    await this.foodAccess.assertCanManageBranchRow(actor, row.tenantId, row.branchId);

    const updated = await this.prisma.billRequest.update({
      where: { id },
      data: {
        ...(dto.status != null ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'BillRequest',
      entityId: id,
      tenantId: updated.tenantId,
      branchId: updated.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Bill request updated',
      changes: dto as object,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }
}
