import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit-logs/audit.service';
import type { AuthUser } from '../auth/types/request-user.type';
import { defaultOrderReference, PaymentsService } from '../payments/payments.service';
import { TenantAccessService } from '../tenants/tenant-access.service';
import type { CreateTipDto } from './dto/create-tip.dto';
import type { PatchTipDto } from './dto/patch-tip.dto';

@Injectable()
export class TipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
  ) {}

  private async assertStaffInTenant(staffId: string, tenantId: string) {
    const st = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId, deletedAt: null },
    });
    if (!st) {
      throw new BadRequestException('Staff not found for this tenant');
    }
    return st;
  }

  private async resolveSession(tenantId: string, sessionId: string | undefined) {
    if (!sessionId) {
      return null;
    }
    const s = await this.prisma.conversationSession.findFirst({
      where: { id: sessionId, tenantId, deletedAt: null },
    });
    if (!s) {
      throw new BadRequestException('Session not found for this tenant');
    }
    return s;
  }

  private async resolveTipEntityLinks(params: {
    tenantId: string;
    sessionId?: string | null;
    diningOrderId?: string | null;
    beautyBookingId?: string | null;
  }): Promise<{ diningOrderId?: string; beautyBookingId?: string }> {
    const dId = params.diningOrderId?.trim() || null;
    const bId = params.beautyBookingId?.trim() || null;
    if (dId && bId) {
      throw new BadRequestException('Tip cannot link to both a dining order and a beauty booking');
    }
    if (!dId && !bId) {
      return {};
    }
    const sessionFilter = params.sessionId ? { sessionId: params.sessionId } : {};
    if (dId) {
      const ord = await this.prisma.diningOrder.findFirst({
        where: {
          id: dId,
          tenantId: params.tenantId,
          deletedAt: null,
          ...sessionFilter,
        },
      });
      if (!ord) {
        throw new BadRequestException('Dining order not found for tip');
      }
      return { diningOrderId: ord.id };
    }
    const booking = await this.prisma.beautyBooking.findFirst({
      where: {
        id: bId!,
        tenantId: params.tenantId,
        deletedAt: null,
        ...sessionFilter,
      },
    });
    if (!booking) {
      throw new BadRequestException('Beauty booking not found for tip');
    }
    return { beautyBookingId: booking.id };
  }

  async create(actor: AuthUser, dto: CreateTipDto) {
    await this.access.assertWritableTenant(actor, dto.tenantId);
    const staff = await this.assertStaffInTenant(dto.staffId, dto.tenantId);
    const session = await this.resolveSession(dto.tenantId, dto.sessionId);
    const branchId = dto.branchId ?? session?.branchId ?? staff.branchId ?? null;
    if (session?.branchId && branchId && session.branchId !== branchId) {
      throw new BadRequestException('Session branch does not match tip branch context');
    }

    const currency = (dto.currency ?? 'TZS').toUpperCase();
    const entityLinks = await this.resolveTipEntityLinks({
      tenantId: dto.tenantId,
      sessionId: dto.sessionId ?? null,
      diningOrderId: dto.diningOrderId,
      beautyBookingId: dto.beautyBookingId,
    });

    if (dto.mode === 'CASH') {
      const tip = await this.prisma.tip.create({
        data: {
          tenantId: dto.tenantId,
          branchId,
          staffId: dto.staffId,
          sessionId: dto.sessionId ?? null,
          mode: 'CASH',
          amountCents: dto.amountCents,
          currency,
          status: 'RECORDED',
          ...(entityLinks.diningOrderId ? { diningOrderId: entityLinks.diningOrderId } : {}),
          ...(entityLinks.beautyBookingId ? { beautyBookingId: entityLinks.beautyBookingId } : {}),
        },
      });
      await this.audit.write({
        action: 'CREATE',
        entityType: 'Tip',
        entityId: tip.id,
        tenantId: tip.tenantId,
        branchId: tip.branchId ?? undefined,
        actorUserId: actor.userId,
        summary: 'Cash tip recorded',
      });
      return tip;
    }

    if (dto.mode === 'DIGITAL') {
      if (!dto.phoneNumber?.trim()) {
        throw new BadRequestException('phoneNumber is required for digital tips');
      }
      await this.payments.loadClickPesaConfigRow(dto.tenantId);
      const orderRef = dto.orderReference ?? defaultOrderReference(dto.tenantId, 'tipd');
      const existing = await this.prisma.paymentTransaction.findUnique({
        where: { orderReference: orderRef },
      });
      if (existing) {
        if (existing.tenantId !== dto.tenantId) {
          throw new BadRequestException('orderReference already used');
        }
        const tips = await this.prisma.tip.findMany({ where: { paymentTxnId: existing.id } });
        if (tips[0]) {
          await this.payments.initiateUssdForTransaction(actor, existing.id);
          return this.prisma.tip.findUniqueOrThrow({
            where: { id: tips[0]!.id },
            include: { paymentTxn: true },
          });
        }
      }

      const cfg = await this.payments.loadClickPesaConfigRow(dto.tenantId);
      if (!cfg.collectionEnabled) {
        throw new BadRequestException('Digital tips require collection-enabled ClickPesa config');
      }

      const tipDigitalMeta: Record<string, unknown> = {
        source: 'dashboard',
        ...(entityLinks.diningOrderId ? { diningOrderId: entityLinks.diningOrderId } : {}),
        ...(entityLinks.beautyBookingId ? { beautyBookingId: entityLinks.beautyBookingId } : {}),
      };
      let txn = await this.prisma.paymentTransaction.create({
        data: {
          tenantId: dto.tenantId,
          branchId,
          sessionId: dto.sessionId ?? null,
          providerConfigId: cfg.id,
          type: 'TIP_DIGITAL',
          amountCents: dto.amountCents,
          currency,
          status: 'PENDING',
          orderReference: orderRef,
          phoneNumber: dto.phoneNumber.trim(),
          metadata: tipDigitalMeta as Prisma.InputJsonValue,
        },
      });

      const tip = await this.prisma.tip.create({
        data: {
          tenantId: dto.tenantId,
          branchId,
          staffId: dto.staffId,
          sessionId: dto.sessionId ?? null,
          mode: 'DIGITAL',
          amountCents: dto.amountCents,
          currency,
          status: 'PENDING',
          paymentTxnId: txn.id,
          ...(entityLinks.diningOrderId ? { diningOrderId: entityLinks.diningOrderId } : {}),
          ...(entityLinks.beautyBookingId ? { beautyBookingId: entityLinks.beautyBookingId } : {}),
        },
      });

      try {
        txn = await this.payments.initiateUssdForTransaction(actor, txn.id);
      } catch {
        // initiateUssdForTransaction updates txn to FAILED on error; tip stays PENDING
      }

      await this.audit.write({
        action: 'CREATE',
        entityType: 'Tip',
        entityId: tip.id,
        tenantId: tip.tenantId,
        branchId: tip.branchId ?? undefined,
        actorUserId: actor.userId,
        summary: 'Digital tip created',
        details: { paymentTxnId: txn.id, orderReference: orderRef } as Prisma.InputJsonValue,
      });

      return this.prisma.tip.findUniqueOrThrow({
        where: { id: tip.id },
        include: { paymentTxn: true },
      });
    }

    throw new BadRequestException('Unsupported tip mode');
  }

  /**
   * Digital tip + USSD from WhatsApp/session (staff must be linked on the session QR).
   */
  async createDigitalTipFromConversation(params: {
    sessionId: string;
    tenantId: string;
    amountCents: number;
    currency: string;
    phoneNumber: string;
    vertical?: 'FOOD_DINING' | 'BEAUTY_GROOMING';
    diningOrderId?: string;
    beautyBookingId?: string;
  }) {
    const sess = await this.prisma.conversationSession.findFirst({
      where: { id: params.sessionId, tenantId: params.tenantId, deletedAt: null },
    });
    if (!sess?.staffId) {
      throw new BadRequestException(
        'Digital tips need a staff-linked session — scan a host or staff QR code.',
      );
    }
    const staff = await this.assertStaffInTenant(sess.staffId, params.tenantId);
    const branchId = sess.branchId ?? staff.branchId ?? null;
    const currency = (params.currency ?? 'TZS').toUpperCase();
    const cfg = await this.payments.loadClickPesaConfigRow(params.tenantId);
    if (!cfg.collectionEnabled) {
      throw new BadRequestException('Digital tips require collection-enabled ClickPesa config');
    }

    const entityLinks = await this.resolveTipEntityLinks({
      tenantId: params.tenantId,
      sessionId: params.sessionId,
      diningOrderId: params.diningOrderId,
      beautyBookingId: params.beautyBookingId,
    });

    const orderRef = defaultOrderReference(params.tenantId, 'tipd');
    const tipMeta: Record<string, unknown> = {
      source: 'conversation',
      staffId: sess.staffId,
      ...(params.vertical ? { vertical: params.vertical } : {}),
      ...(entityLinks.diningOrderId ? { diningOrderId: entityLinks.diningOrderId } : {}),
      ...(entityLinks.beautyBookingId ? { beautyBookingId: entityLinks.beautyBookingId } : {}),
    };
    let txn = await this.prisma.paymentTransaction.create({
      data: {
        tenantId: params.tenantId,
        branchId,
        sessionId: params.sessionId,
        providerConfigId: cfg.id,
        type: 'TIP_DIGITAL',
        amountCents: params.amountCents,
        currency,
        status: 'PENDING',
        orderReference: orderRef,
        phoneNumber: params.phoneNumber.trim().replace(/\s/g, ''),
        metadata: tipMeta as Prisma.InputJsonValue,
      },
    });

    const tip = await this.prisma.tip.create({
      data: {
        tenantId: params.tenantId,
        branchId,
        staffId: sess.staffId,
        sessionId: params.sessionId,
        mode: 'DIGITAL',
        amountCents: params.amountCents,
        currency,
        status: 'PENDING',
        paymentTxnId: txn.id,
        ...(entityLinks.diningOrderId ? { diningOrderId: entityLinks.diningOrderId } : {}),
        ...(entityLinks.beautyBookingId ? { beautyBookingId: entityLinks.beautyBookingId } : {}),
      },
    });

    try {
      txn = await this.payments.initiateUssdForTransactionFromSession(params.sessionId, txn.id);
    } catch {
      /* USSD failure reflected on txn row */
    }

    await this.audit.write({
      action: 'CREATE',
      entityType: 'Tip',
      entityId: tip.id,
      tenantId: tip.tenantId,
      branchId: tip.branchId ?? undefined,
      actorType: 'CONVERSATION_SESSION',
      summary: 'Digital tip from conversation (USSD)',
      details: {
        paymentTxnId: txn.id,
        orderReference: orderRef,
        ...entityLinks,
      } as Prisma.InputJsonValue,
    });

    return this.prisma.tip.findUniqueOrThrow({
      where: { id: tip.id },
      include: { paymentTxn: true },
    });
  }

  async findAll(actor: AuthUser, tenantId: string) {
    await this.access.assertReadableTenant(actor, tenantId);
    return this.prisma.tip.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { paymentTxn: true },
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const row = await this.prisma.tip.findFirst({
      where: { id },
      include: { paymentTxn: true },
    });
    if (!row) {
      throw new NotFoundException('Tip not found');
    }
    await this.access.assertReadableTenant(actor, row.tenantId);
    return row;
  }

  async patch(actor: AuthUser, id: string, dto: PatchTipDto) {
    const row = await this.prisma.tip.findFirst({ where: { id } });
    if (!row) {
      throw new NotFoundException('Tip not found');
    }
    await this.access.assertWritableTenant(actor, row.tenantId);
    const updated = await this.prisma.tip.update({
      where: { id },
      data: {
        ...(dto.status != null ? { status: dto.status } : {}),
      },
      include: { paymentTxn: true },
    });
    await this.audit.write({
      action: 'UPDATE',
      entityType: 'Tip',
      entityId: id,
      tenantId: updated.tenantId,
      branchId: updated.branchId ?? undefined,
      actorUserId: actor.userId,
      summary: 'Tip updated',
      changes: dto as object as Prisma.InputJsonValue,
    });
    return updated;
  }
}
