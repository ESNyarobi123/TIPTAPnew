import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { DiningOrderItemStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditService } from '../../audit-logs/audit.service';
import type { AuthUser } from '../../auth/types/request-user.type';
import { TenantAccessService } from '../../tenants/tenant-access.service';
import { QrTokenService } from '../../qr/qr-token.service';
import { FoodDiningAccessService } from '../food-dining-access.service';
import type { FoodDiningRequestMeta } from '../menu-categories/menu-categories.service';
import type { CreateKdsTokenDto } from './dto/create-kds-token.dto';
import type { PatchKdsItemDto } from './dto/patch-kds-item.dto';

@Injectable()
export class KdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly foodAccess: FoodDiningAccessService,
    private readonly access: TenantAccessService,
    private readonly qrTokens: QrTokenService,
    private readonly audit: AuditService,
  ) {}

  private async staffIdForActor(tenantId: string, actor: AuthUser) {
    const s = await this.prisma.staff.findFirst({
      where: { tenantId, userId: actor.userId, deletedAt: null },
      select: { id: true },
    });
    return s?.id ?? null;
  }

  async createToken(actor: AuthUser, dto: CreateKdsTokenDto, meta: FoodDiningRequestMeta) {
    await this.foodAccess.assertCanManageBranchRow(actor, dto.tenantId, dto.branchId);
    await this.access.assertBranchBelongsToTenant(dto.branchId, dto.tenantId);

    const rawToken = this.qrTokens.generateRawToken();
    const tokenHash = this.qrTokens.sha256Hex(rawToken);
    const expiresAt = dto.expiresAt?.trim() ? new Date(dto.expiresAt) : null;
    const createdByStaffId = await this.staffIdForActor(dto.tenantId, actor);

    const row = await this.prisma.kdsToken.create({
      data: {
        tenantId: dto.tenantId,
        branchId: dto.branchId,
        tokenHash,
        name: dto.name.trim(),
        expiresAt,
        createdByStaffId,
      },
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'KdsToken',
      entityId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'KDS token created',
      details: { name: row.name },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      id: row.id,
      name: row.name,
      tenantId: row.tenantId,
      branchId: row.branchId,
      expiresAt: row.expiresAt,
      rawToken,
      createdAt: row.createdAt,
    };
  }

  async listTokens(actor: AuthUser, tenantId: string, branchId?: string) {
    const tid = await this.foodAccess.resolveTenantId(actor, tenantId);
    await this.foodAccess.assertReadableTenantFood(actor, tid);
    return this.prisma.kdsToken.findMany({
      where: {
        tenantId: tid,
        ...(branchId?.trim() ? { branchId: branchId.trim() } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        tenantId: true,
        branchId: true,
        isActive: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async revokeToken(actor: AuthUser, id: string, meta: FoodDiningRequestMeta) {
    const row = await this.prisma.kdsToken.findFirst({ where: { id } });
    if (!row) {
      throw new NotFoundException('KDS token not found');
    }
    await this.foodAccess.assertCanManageBranchRow(actor, row.tenantId, row.branchId);

    const updated = await this.prisma.kdsToken.update({
      where: { id },
      data: { isActive: false, revokedAt: new Date() },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'KdsToken',
      entityId: id,
      tenantId: updated.tenantId,
      branchId: updated.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'KDS token revoked',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  async resolveToken(rawToken: string) {
    const hash = this.qrTokens.sha256Hex(rawToken.trim());
    const row = await this.prisma.kdsToken.findFirst({
      where: { tokenHash: hash },
    });
    if (!row || !row.isActive || row.revokedAt) {
      throw new UnauthorizedException('Invalid or revoked kitchen token');
    }
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Kitchen token expired');
    }
    return row;
  }

  async getLiveOrders(rawToken: string) {
    const t = await this.resolveToken(rawToken);
    return this.prisma.diningOrder.findMany({
      where: {
        tenantId: t.tenantId,
        branchId: t.branchId,
        deletedAt: null,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: {
        items: {
          include: {
            menuItem: { select: { id: true, name: true } },
          },
        },
        diningTable: { select: { id: true, code: true, label: true } },
      },
    });
  }

  async getHistory(rawToken: string) {
    const t = await this.resolveToken(rawToken);
    return this.prisma.diningOrder.findMany({
      where: {
        tenantId: t.tenantId,
        branchId: t.branchId,
        deletedAt: null,
        status: 'COMPLETED',
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        items: {
          include: {
            menuItem: { select: { id: true, name: true } },
          },
        },
        diningTable: { select: { id: true, code: true, label: true } },
      },
    });
  }

  async patchItemStatus(rawToken: string, itemId: string, dto: PatchKdsItemDto) {
    const t = await this.resolveToken(rawToken);
    const allowed: DiningOrderItemStatus[] = ['PENDING', 'PREPARING', 'READY'];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException('Kitchen can only set item status to PENDING, PREPARING, or READY');
    }

    const line = await this.prisma.diningOrderItem.findFirst({
      where: { id: itemId },
      include: { order: true },
    });
    if (!line || line.order.tenantId !== t.tenantId || line.order.branchId !== t.branchId) {
      throw new NotFoundException('Order item not found');
    }
    if (line.order.deletedAt) {
      throw new BadRequestException('Order is no longer active');
    }

    return this.prisma.diningOrderItem.update({
      where: { id: itemId },
      data: { status: dto.status },
      include: {
        menuItem: { select: { id: true, name: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
      },
    });
  }
}
