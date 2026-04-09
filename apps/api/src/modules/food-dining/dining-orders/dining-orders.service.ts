import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  DiningOrderItemStatus,
  DiningOrderStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditService } from '../../audit-logs/audit.service';
import type { AuthUser } from '../../auth/types/request-user.type';
import { QrTokenService } from '../../qr/qr-token.service';
import { TenantAccessService } from '../../tenants/tenant-access.service';
import { FoodDiningAccessService } from '../food-dining-access.service';
import type { FoodDiningRequestMeta } from '../menu-categories/menu-categories.service';
import { branchCodePrefix } from './branch-order-code';
import type { AddDiningOrderItemDto } from './dto/add-dining-order-item.dto';
import type { CreateDiningOrderDto, CreateDiningOrderLineDto } from './dto/create-dining-order.dto';
import type { PatchDiningOrderDto } from './dto/patch-dining-order.dto';
import type { PatchDiningOrderItemDto } from './dto/patch-dining-order-item.dto';

const CART_ORDER_STATUSES: DiningOrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'SERVED',
];

@Injectable()
export class DiningOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly foodAccess: FoodDiningAccessService,
    private readonly access: TenantAccessService,
    private readonly audit: AuditService,
    private readonly qrTokens: QrTokenService,
  ) {}

  /** Never expose portal hash secrets to staff JWT responses. */
  private redactDiningOrder<O extends { portalTokenHash?: string | null; portalTokenCreatedAt?: Date | null }>(
    o: O,
  ): Omit<O, 'portalTokenHash' | 'portalTokenCreatedAt'> {
    const { portalTokenHash: _h, portalTokenCreatedAt: _c, ...rest } = o;
    return rest;
  }

  private branchItemScope(branchId: string): { OR: Prisma.DiningMenuItemWhereInput[] } {
    return { OR: [{ branchId: null }, { branchId }] };
  }

  private async assertMenuItemForBranch(
    tenantId: string,
    branchId: string,
    menuItemId: string,
  ) {
    const item = await this.prisma.diningMenuItem.findFirst({
      where: {
        id: menuItemId,
        tenantId,
        deletedAt: null,
        isAvailable: true,
        ...this.branchItemScope(branchId),
      },
    });
    if (!item) {
      throw new BadRequestException('Menu item not available for this branch');
    }
    return item;
  }

  private async resolveLinePrice(
    line: CreateDiningOrderLineDto | AddDiningOrderItemDto,
    catalogUnit: number,
  ) {
    const qty = line.quantity ?? 1;
    const unit = line.unitPriceCents ?? catalogUnit;
    return { quantity: qty, unitPriceCents: unit, totalPriceCents: qty * unit };
  }

  private async recomputeTotals(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.diningOrder.findFirst({ where: { id: orderId } });
    if (!order) {
      return;
    }
    const agg = await tx.diningOrderItem.aggregate({
      where: { orderId },
      _sum: { totalPriceCents: true },
    });
    const subtotal = agg._sum.totalPriceCents ?? 0;
    const total = subtotal + order.taxCents;
    await tx.diningOrder.update({
      where: { id: orderId },
      data: { subtotalCents: subtotal, totalCents: total },
    });
  }

  private async nextOrderNumber(
    tx: Prisma.TransactionClient,
    branchId: string,
  ): Promise<string> {
    const b = await tx.branch.update({
      where: { id: branchId },
      data: { nextDiningOrderSeq: { increment: 1 } },
      select: { nextDiningOrderSeq: true, code: true },
    });
    const prefix = branchCodePrefix(b.code);
    return `ORD-${prefix}-${String(b.nextDiningOrderSeq).padStart(4, '0')}`;
  }

  async addLineFromConversation(
    params: {
      sessionId: string;
      tenantId: string;
      branchId: string;
      diningTableId: string | null;
      customerPhone: string | null;
      menuItemId: string;
      quantity: number;
    },
    meta: FoodDiningRequestMeta,
  ): Promise<{ orderNumber: string; quantity: number }> {
    await this.access.assertBranchBelongsToTenant(params.branchId, params.tenantId);
    const item = await this.assertMenuItemForBranch(
      params.tenantId,
      params.branchId,
      params.menuItemId,
    );
    const qty = params.quantity < 1 ? 1 : params.quantity;
    const { unitPriceCents, totalPriceCents } = (
      await this.resolveLinePrice({ menuItemId: params.menuItemId, quantity: qty }, item.priceCents)
    );

    const out = await this.prisma.$transaction(async (tx) => {
      let order = await tx.diningOrder.findFirst({
        where: {
          sessionId: params.sessionId,
          deletedAt: null,
          status: { in: CART_ORDER_STATUSES },
        },
      });

      if (!order) {
        const orderNumber = await this.nextOrderNumber(tx, params.branchId);
        order = await tx.diningOrder.create({
          data: {
            tenantId: params.tenantId,
            branchId: params.branchId,
            diningTableId: params.diningTableId,
            sessionId: params.sessionId,
            customerPhone: params.customerPhone,
            orderNumber,
            status: 'PENDING',
            currency: item.currency,
            taxCents: 0,
            subtotalCents: 0,
            totalCents: 0,
          },
        });
      } else {
        if (order.tenantId !== params.tenantId || order.branchId !== params.branchId) {
          throw new BadRequestException('Session order branch mismatch');
        }
      }

      await tx.diningOrderItem.create({
        data: {
          orderId: order.id,
          menuItemId: item.id,
          quantity: qty,
          unitPriceCents,
          totalPriceCents,
          status: 'PENDING',
        },
      });

      await this.recomputeTotals(tx, order.id);
      const fresh = await tx.diningOrder.findFirstOrThrow({
        where: { id: order.id },
        select: { orderNumber: true, id: true },
      });
      return fresh;
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'DiningOrderItem',
      entityId: out.id,
      tenantId: params.tenantId,
      branchId: params.branchId,
      actorType: 'CONVERSATION_SESSION',
      correlationId: meta.correlationId,
      summary: 'Order line from conversation',
      details: { sessionId: params.sessionId, orderNumber: out.orderNumber, quantity: qty },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { orderNumber: out.orderNumber, quantity: qty };
  }

  /** Active cart / in-flight dining order for a conversation session (WhatsApp pay flow). */
  async findOpenOrderSummaryForSession(sessionId: string): Promise<{
    id: string;
    orderNumber: string;
    totalCents: number;
    currency: string;
  } | null> {
    const order = await this.prisma.diningOrder.findFirst({
      where: {
        sessionId,
        deletedAt: null,
        status: { in: CART_ORDER_STATUSES },
      },
      select: { id: true, orderNumber: true, totalCents: true, currency: true },
    });
    return order;
  }

  async create(actor: AuthUser, dto: CreateDiningOrderDto, meta: FoodDiningRequestMeta) {
    await this.foodAccess.assertCanOperateBranchOrders(actor, dto.tenantId, dto.branchId);
    await this.access.assertBranchBelongsToTenant(dto.branchId, dto.tenantId);
    if (dto.diningTableId) {
      const table = await this.prisma.diningTable.findFirst({
        where: {
          id: dto.diningTableId,
          tenantId: dto.tenantId,
          branchId: dto.branchId,
          deletedAt: null,
        },
      });
      if (!table) {
        throw new BadRequestException('diningTableId invalid for tenant/branch');
      }
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const orderNumber = await this.nextOrderNumber(tx, dto.branchId);
      let currency = 'USD';
      const o = await tx.diningOrder.create({
        data: {
          tenantId: dto.tenantId,
          branchId: dto.branchId,
          diningTableId: dto.diningTableId ?? null,
          sessionId: dto.sessionId ?? null,
          customerPhone: dto.customerPhone?.trim() ?? null,
          orderNumber,
          notes: dto.notes?.trim(),
          status: 'PENDING',
          currency,
          taxCents: 0,
          subtotalCents: 0,
          totalCents: 0,
        },
      });

      if (dto.items?.length) {
        for (const line of dto.items) {
          const item = await this.assertMenuItemForBranch(
            dto.tenantId,
            dto.branchId,
            line.menuItemId,
          );
          currency = item.currency;
          const { quantity, unitPriceCents, totalPriceCents } = await this.resolveLinePrice(
            line,
            item.priceCents,
          );
          await tx.diningOrderItem.create({
            data: {
              orderId: o.id,
              menuItemId: item.id,
              quantity,
              unitPriceCents,
              totalPriceCents,
              modifiers: (line.modifiers ?? undefined) as Prisma.InputJsonValue | undefined,
              notes: line.notes?.trim(),
              status: 'PENDING',
            },
          });
        }
        await tx.diningOrder.update({
          where: { id: o.id },
          data: { currency },
        });
        await this.recomputeTotals(tx, o.id);
      }

      return tx.diningOrder.findFirstOrThrow({
        where: { id: o.id },
        include: { items: { include: { menuItem: true } } },
      });
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'DiningOrder',
      entityId: order.id,
      tenantId: order.tenantId,
      branchId: order.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Dining order created',
      details: { orderNumber: order.orderNumber },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.redactDiningOrder(order);
  }

  async findAll(
    actor: AuthUser,
    tenantId: string,
    q: {
      branchId?: string;
      status?: DiningOrderStatus;
      staffId?: string;
    },
  ) {
    await this.foodAccess.assertReadableTenantFood(actor, tenantId);
    const rows = await this.prisma.diningOrder.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(q.branchId?.trim() ? { branchId: q.branchId.trim() } : {}),
        ...(q.status ? { status: q.status } : {}),
        ...(q.staffId?.trim()
          ? {
              OR: [{ staffId: q.staffId.trim() }, { claimedByStaffId: q.staffId.trim() }],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { menuItem: { select: { id: true, name: true, priceCents: true } } } },
      },
      take: 200,
    });
    return rows.map((r) => this.redactDiningOrder(r));
  }

  async findOne(actor: AuthUser, id: string) {
    const row = await this.prisma.diningOrder.findFirst({
      where: { id, deletedAt: null },
      include: { items: { include: { menuItem: true } } },
    });
    if (!row) {
      throw new NotFoundException('Order not found');
    }
    await this.foodAccess.assertReadableTenantFood(actor, row.tenantId);
    return this.redactDiningOrder(row);
  }

  async patch(actor: AuthUser, id: string, dto: PatchDiningOrderDto, meta: FoodDiningRequestMeta) {
    const row = await this.prisma.diningOrder.findFirst({ where: { id, deletedAt: null } });
    if (!row) {
      throw new NotFoundException('Order not found');
    }
    await this.foodAccess.assertCanOperateBranchOrders(actor, row.tenantId, row.branchId);

    const paidAt = dto.paidAt?.trim() ? new Date(dto.paidAt) : undefined;

    await this.prisma.diningOrder.update({
      where: { id },
      data: {
        ...(dto.status != null ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.taxCents != null ? { taxCents: dto.taxCents } : {}),
        ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod } : {}),
        ...(paidAt !== undefined ? { paidAt } : {}),
      },
    });

    await this.recomputeTotals(this.prisma, id);

    const out = await this.prisma.diningOrder.findFirstOrThrow({
      where: { id },
      include: { items: { include: { menuItem: true } } },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'DiningOrder',
      entityId: id,
      tenantId: out.tenantId,
      branchId: out.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Dining order updated',
      changes: dto as object,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.redactDiningOrder(out);
  }

  private async staffProfileForActor(tenantId: string, actor: AuthUser) {
    const s = await this.prisma.staff.findFirst({
      where: { tenantId, userId: actor.userId, deletedAt: null },
    });
    if (!s) {
      throw new ForbiddenException('No staff profile linked to this user');
    }
    return s;
  }

  async claim(actor: AuthUser, id: string, meta: FoodDiningRequestMeta) {
    const row = await this.prisma.diningOrder.findFirst({ where: { id, deletedAt: null } });
    if (!row) {
      throw new NotFoundException('Order not found');
    }
    await this.foodAccess.assertCanOperateBranchOrders(actor, row.tenantId, row.branchId);
    const staff = await this.staffProfileForActor(row.tenantId, actor);

    const updated = await this.prisma.diningOrder.update({
      where: { id },
      data: {
        claimedAt: new Date(),
        claimedByStaffId: staff.id,
        staffId: row.staffId ?? staff.id,
      },
      include: { items: { include: { menuItem: true } } },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'DiningOrder',
      entityId: id,
      tenantId: updated.tenantId,
      branchId: updated.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Dining order claimed',
      details: { claimedByStaffId: staff.id },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.redactDiningOrder(updated);
  }

  async mintPortalToken(actor: AuthUser, id: string, meta: FoodDiningRequestMeta) {
    const row = await this.prisma.diningOrder.findFirst({ where: { id, deletedAt: null } });
    if (!row) {
      throw new NotFoundException('Order not found');
    }
    await this.foodAccess.assertCanOperateBranchOrders(actor, row.tenantId, row.branchId);
    const rawToken = this.qrTokens.generateRawToken();
    const tokenHash = this.qrTokens.sha256Hex(rawToken);
    const createdAt = new Date();
    await this.prisma.diningOrder.update({
      where: { id },
      data: { portalTokenHash: tokenHash, portalTokenCreatedAt: createdAt },
    });
    await this.audit.write({
      action: 'UPDATE',
      entityType: 'DiningOrder',
      entityId: id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Dining order portal token minted',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return { id, rawToken, portalTokenCreatedAt: createdAt };
  }

  async revokePortalToken(actor: AuthUser, id: string, meta: FoodDiningRequestMeta) {
    const row = await this.prisma.diningOrder.findFirst({ where: { id, deletedAt: null } });
    if (!row) {
      throw new NotFoundException('Order not found');
    }
    await this.foodAccess.assertCanOperateBranchOrders(actor, row.tenantId, row.branchId);
    await this.prisma.diningOrder.update({
      where: { id },
      data: { portalTokenHash: null, portalTokenCreatedAt: null },
    });
    await this.audit.write({
      action: 'UPDATE',
      entityType: 'DiningOrder',
      entityId: id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Dining order portal token revoked',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  /** Public read-only snapshot for customer display (no auth). */
  async getPublicOrderByPortalToken(rawToken: string) {
    const hash = this.qrTokens.sha256Hex(rawToken.trim());
    const row = await this.prisma.diningOrder.findFirst({
      where: { portalTokenHash: hash, deletedAt: null },
      include: {
        branch: { select: { name: true, code: true } },
        items: {
          include: {
            menuItem: { select: { name: true } },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('Order not found');
    }
    return {
      orderNumber: row.orderNumber,
      status: row.status,
      currency: row.currency,
      subtotalCents: row.subtotalCents,
      taxCents: row.taxCents,
      totalCents: row.totalCents,
      createdAt: row.createdAt,
      branch: { name: row.branch.name, code: row.branch.code },
      items: row.items.map((it) => ({
        name: it.menuItem.name,
        quantity: it.quantity,
        status: it.status,
        unitPriceCents: it.unitPriceCents,
        totalPriceCents: it.totalPriceCents,
      })),
    };
  }

  async assertOrderMutable(order: { status: DiningOrderStatus }) {
    if (!CART_ORDER_STATUSES.includes(order.status)) {
      throw new BadRequestException('Order cannot be modified in this status');
    }
  }

  async addItem(actor: AuthUser, orderId: string, dto: AddDiningOrderItemDto, meta: FoodDiningRequestMeta) {
    const row = await this.prisma.diningOrder.findFirst({ where: { id: orderId, deletedAt: null } });
    if (!row) {
      throw new NotFoundException('Order not found');
    }
    await this.foodAccess.assertCanOperateBranchOrders(actor, row.tenantId, row.branchId);
    await this.assertOrderMutable(row);

    const item = await this.assertMenuItemForBranch(row.tenantId, row.branchId, dto.menuItemId);
    const { quantity, unitPriceCents, totalPriceCents } = await this.resolveLinePrice(dto, item.priceCents);

    const line = await this.prisma.diningOrderItem.create({
      data: {
        orderId: row.id,
        menuItemId: item.id,
        quantity,
        unitPriceCents,
        totalPriceCents,
        modifiers: (dto.modifiers ?? undefined) as Prisma.InputJsonValue | undefined,
        notes: dto.notes?.trim(),
        status: 'PENDING',
      },
    });

    await this.recomputeTotals(this.prisma, row.id);

    await this.audit.write({
      action: 'CREATE',
      entityType: 'DiningOrderItem',
      entityId: line.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Order line added',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.findOne(actor, orderId);
  }

  async patchItem(
    actor: AuthUser,
    orderId: string,
    itemId: string,
    dto: PatchDiningOrderItemDto,
    meta: FoodDiningRequestMeta,
  ) {
    const row = await this.prisma.diningOrder.findFirst({ where: { id: orderId, deletedAt: null } });
    if (!row) {
      throw new NotFoundException('Order not found');
    }
    await this.foodAccess.assertCanOperateBranchOrders(actor, row.tenantId, row.branchId);
    await this.assertOrderMutable(row);

    const line = await this.prisma.diningOrderItem.findFirst({
      where: { id: itemId, orderId },
    });
    if (!line) {
      throw new NotFoundException('Order item not found');
    }

    const qty = dto.quantity ?? line.quantity;
    const unit = line.unitPriceCents;
    const totalPriceCents = qty * unit;

    await this.prisma.diningOrderItem.update({
      where: { id: itemId },
      data: {
        ...(dto.quantity != null ? { quantity: dto.quantity, totalPriceCents } : {}),
        ...(dto.status != null ? { status: dto.status as DiningOrderItemStatus } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    await this.recomputeTotals(this.prisma, orderId);

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'DiningOrderItem',
      entityId: itemId,
      tenantId: row.tenantId,
      branchId: row.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Order line updated',
      changes: dto as object,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.findOne(actor, orderId);
  }

  async removeItem(actor: AuthUser, orderId: string, itemId: string, meta: FoodDiningRequestMeta) {
    const row = await this.prisma.diningOrder.findFirst({ where: { id: orderId, deletedAt: null } });
    if (!row) {
      throw new NotFoundException('Order not found');
    }
    await this.foodAccess.assertCanOperateBranchOrders(actor, row.tenantId, row.branchId);
    await this.assertOrderMutable(row);

    const line = await this.prisma.diningOrderItem.findFirst({
      where: { id: itemId, orderId },
    });
    if (!line) {
      throw new NotFoundException('Order item not found');
    }

    await this.prisma.diningOrderItem.delete({ where: { id: itemId } });
    await this.recomputeTotals(this.prisma, orderId);

    await this.audit.write({
      action: 'DELETE',
      entityType: 'DiningOrderItem',
      entityId: itemId,
      tenantId: row.tenantId,
      branchId: row.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Order line removed',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.findOne(actor, orderId);
  }
}
