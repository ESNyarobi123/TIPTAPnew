import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  BeautyBookingServiceStatus,
  BeautyBookingStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditService } from '../../audit-logs/audit.service';
import type { AuthUser } from '../../auth/types/request-user.type';
import { branchCodePrefix } from '../../food-dining/dining-orders/branch-order-code';
import { QrTokenService } from '../../qr/qr-token.service';
import { TenantAccessService } from '../../tenants/tenant-access.service';
import type { FoodDiningRequestMeta } from '../../food-dining/menu-categories/menu-categories.service';
import { assertScheduledAtFitsBranchOperatingHours } from '../../branches/operating-hours-schedule';
import { BeautyGroomingAccessService } from '../beauty-grooming-access.service';
import type { AddBeautyBookingServiceDto } from './dto/add-beauty-booking-service.dto';
import type { CreateBeautyBookingDto, CreateBeautyBookingServiceLineDto } from './dto/create-beauty-booking.dto';
import type { PatchBeautyBookingDto } from './dto/patch-beauty-booking.dto';
import type { PatchBeautyBookingServiceDto } from './dto/patch-beauty-booking-service.dto';

const OPEN_BOOKING_STATUSES: BeautyBookingStatus[] = [
  'BOOKED',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_SERVICE',
];

@Injectable()
export class BeautyBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly beautyAccess: BeautyGroomingAccessService,
    private readonly access: TenantAccessService,
    private readonly audit: AuditService,
    private readonly qrTokens: QrTokenService,
  ) {}

  private redactBooking<O extends { portalTokenHash?: string | null; portalTokenCreatedAt?: Date | null }>(
    o: O,
  ): Omit<O, 'portalTokenHash' | 'portalTokenCreatedAt'> {
    const { portalTokenHash: _h, portalTokenCreatedAt: _c, ...rest } = o;
    return rest;
  }

  private branchServiceScope(branchId: string): { OR: Prisma.BeautyServiceWhereInput[] } {
    return { OR: [{ branchId: null }, { branchId }] };
  }

  private async assertServiceForBranch(tenantId: string, branchId: string, beautyServiceId: string) {
    const svc = await this.prisma.beautyService.findFirst({
      where: {
        id: beautyServiceId,
        tenantId,
        deletedAt: null,
        isActive: true,
        ...this.branchServiceScope(branchId),
      },
    });
    if (!svc) {
      throw new BadRequestException('Beauty service not available for this branch');
    }
    return svc;
  }

  private async recomputeBookingTotal(tx: Prisma.TransactionClient, bookingId: string) {
    const agg = await tx.beautyBookingService.aggregate({
      where: { bookingId },
      _sum: { priceCents: true },
    });
    const total = agg._sum.priceCents ?? 0;
    await tx.beautyBooking.update({
      where: { id: bookingId },
      data: { totalCents: total },
    });
  }

  private async nextBookingNumber(tx: Prisma.TransactionClient, branchId: string): Promise<string> {
    const b = await tx.branch.update({
      where: { id: branchId },
      data: { nextBeautyBookingSeq: { increment: 1 } },
      select: { nextBeautyBookingSeq: true, code: true },
    });
    const prefix = branchCodePrefix(b.code);
    return `BKG-${prefix}-${String(b.nextBeautyBookingSeq).padStart(4, '0')}`;
  }

  async addServiceFromConversation(
    params: {
      sessionId: string;
      tenantId: string;
      branchId: string;
      stationId: string | null;
      customerPhone: string | null;
      beautyServiceId: string;
    },
    meta: FoodDiningRequestMeta,
  ): Promise<{ bookingNumber: string }> {
    await this.access.assertBranchBelongsToTenant(params.branchId, params.tenantId);
    const svc = await this.assertServiceForBranch(
      params.tenantId,
      params.branchId,
      params.beautyServiceId,
    );
    const priceCents = svc.priceCents ?? 0;
    const currency = svc.currency ?? 'USD';

    const txResult = await this.prisma.$transaction(async (tx) => {
      let booking = await tx.beautyBooking.findFirst({
        where: {
          sessionId: params.sessionId,
          deletedAt: null,
          status: { in: OPEN_BOOKING_STATUSES },
        },
      });

      if (!booking) {
        const num = await this.nextBookingNumber(tx, params.branchId);
        booking = await tx.beautyBooking.create({
          data: {
            tenantId: params.tenantId,
            branchId: params.branchId,
            stationId: params.stationId,
            sessionId: params.sessionId,
            customerPhone: params.customerPhone,
            bookingNumber: num,
            status: 'CHECKED_IN',
            isWalkIn: true,
            checkedInAt: new Date(),
            currency,
            totalCents: 0,
          },
        });
      } else {
        if (booking.tenantId !== params.tenantId || booking.branchId !== params.branchId) {
          throw new BadRequestException('Session booking branch mismatch');
        }
      }

      const line = await tx.beautyBookingService.create({
        data: {
          bookingId: booking.id,
          beautyServiceId: svc.id,
          priceCents,
          durationMin: svc.durationMin,
          status: 'PENDING',
        },
      });
      await this.recomputeBookingTotal(tx, booking.id);

      const fresh = await tx.beautyBooking.findFirstOrThrow({
        where: { id: booking.id },
        select: { bookingNumber: true },
      });
      return { bookingNumber: fresh.bookingNumber, serviceLineId: line.id };
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'BeautyBookingService',
      entityId: txResult.serviceLineId,
      tenantId: params.tenantId,
      branchId: params.branchId,
      actorType: 'CONVERSATION_SESSION',
      correlationId: meta.correlationId,
      summary: 'Booking service line from conversation',
      details: { sessionId: params.sessionId, bookingNumber: txResult.bookingNumber },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { bookingNumber: txResult.bookingNumber };
  }

  /** Active visit / walk-in booking for WhatsApp pay flow (session-scoped). */
  async findOpenBookingSummaryForSession(sessionId: string): Promise<{
    id: string;
    bookingNumber: string;
    totalCents: number;
    currency: string;
  } | null> {
    const booking = await this.prisma.beautyBooking.findFirst({
      where: {
        sessionId,
        deletedAt: null,
        status: { in: OPEN_BOOKING_STATUSES },
      },
      select: { id: true, bookingNumber: true, totalCents: true, currency: true },
    });
    if (!booking || booking.totalCents < 1) {
      return null;
    }
    return booking;
  }

  /** Session booking for tipping (no minimum total — unlike pay-bill summary). */
  async findSessionBookingIdForTipLink(sessionId: string): Promise<string | null> {
    const booking = await this.prisma.beautyBooking.findFirst({
      where: {
        sessionId,
        deletedAt: null,
        status: { in: OPEN_BOOKING_STATUSES },
      },
      select: { id: true },
    });
    return booking?.id ?? null;
  }

  private async appendServiceLines(
    tx: Prisma.TransactionClient,
    bookingId: string,
    tenantId: string,
    branchId: string,
    lines: CreateBeautyBookingServiceLineDto[],
  ) {
    let currency = 'USD';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const svc = await this.assertServiceForBranch(tenantId, branchId, line.beautyServiceId);
      if (i === 0) {
        currency = svc.currency ?? 'USD';
      }
      await tx.beautyBookingService.create({
        data: {
          bookingId,
          beautyServiceId: svc.id,
          staffId: line.staffId ?? null,
          priceCents: svc.priceCents ?? 0,
          durationMin: svc.durationMin,
          status: 'PENDING',
        },
      });
    }
    await tx.beautyBooking.update({
      where: { id: bookingId },
      data: { currency },
    });
    await this.recomputeBookingTotal(tx, bookingId);
  }

  async create(actor: AuthUser, dto: CreateBeautyBookingDto, meta: FoodDiningRequestMeta) {
    await this.beautyAccess.assertCanOperateBranchBookings(actor, dto.tenantId, dto.branchId);
    await this.access.assertBranchBelongsToTenant(dto.branchId, dto.tenantId);

    if (dto.stationId) {
      const st = await this.prisma.beautyStation.findFirst({
        where: { id: dto.stationId, tenantId: dto.tenantId, branchId: dto.branchId, deletedAt: null },
      });
      if (!st) {
        throw new BadRequestException('stationId invalid for tenant/branch');
      }
    }

    const walkIn = dto.isWalkIn === true;
    const scheduledAt = dto.scheduledAt?.trim() ? new Date(dto.scheduledAt) : null;
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('scheduledAt is not a valid date');
    }

    const branchForHours = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, tenantId: dto.tenantId, deletedAt: null },
      select: { operatingHours: true, timezone: true },
    });
    if (scheduledAt) {
      assertScheduledAtFitsBranchOperatingHours(
        scheduledAt,
        branchForHours?.operatingHours ?? null,
        branchForHours?.timezone ?? null,
      );
    }

    const status: BeautyBookingStatus = walkIn ? 'CHECKED_IN' : 'BOOKED';
    const checkedInAt = walkIn ? new Date() : null;

    const booking = await this.prisma.$transaction(async (tx) => {
      const bookingNumber = await this.nextBookingNumber(tx, dto.branchId);
      const b = await tx.beautyBooking.create({
        data: {
          tenantId: dto.tenantId,
          branchId: dto.branchId,
          stationId: dto.stationId ?? null,
          staffId: dto.staffId ?? null,
          sessionId: dto.sessionId ?? null,
          customerPhone: dto.customerPhone?.trim() ?? null,
          customerName: dto.customerName?.trim() ?? null,
          scheduledAt,
          bookingNumber,
          status,
          isWalkIn: walkIn,
          checkedInAt,
          notes: dto.notes?.trim(),
          currency: 'USD',
          totalCents: 0,
        },
      });

      if (dto.services?.length) {
        await this.appendServiceLines(tx, b.id, dto.tenantId, dto.branchId, dto.services);
      }

      return tx.beautyBooking.findFirstOrThrow({
        where: { id: b.id },
        include: { services: { include: { beautyService: true } } },
      });
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'BeautyBooking',
      entityId: booking.id,
      tenantId: booking.tenantId,
      branchId: booking.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Beauty booking created',
      details: { bookingNumber: booking.bookingNumber },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.redactBooking(booking);
  }

  async findAll(
    actor: AuthUser,
    tenantId: string,
    q: { branchId?: string; status?: BeautyBookingStatus; staffId?: string; date?: string },
  ) {
    await this.beautyAccess.assertReadableTenantBeauty(actor, tenantId);

    let dayFilter: Prisma.DateTimeFilter | undefined;
    if (q.date?.trim()) {
      const d = q.date.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        throw new BadRequestException('date must be YYYY-MM-DD');
      }
      const start = new Date(`${d}T00:00:00.000Z`);
      const end = new Date(`${d}T23:59:59.999Z`);
      dayFilter = { gte: start, lte: end };
    }

    const rows = await this.prisma.beautyBooking.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(q.branchId?.trim() ? { branchId: q.branchId.trim() } : {}),
        ...(q.status ? { status: q.status } : {}),
        ...(q.staffId?.trim() ? { staffId: q.staffId.trim() } : {}),
        ...(dayFilter ? { scheduledAt: dayFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        services: { include: { beautyService: { select: { id: true, name: true } } } },
      },
      take: 200,
    });
    return rows.map((r) => this.redactBooking(r));
  }

  async findOne(actor: AuthUser, id: string) {
    const row = await this.prisma.beautyBooking.findFirst({
      where: { id, deletedAt: null },
      include: { services: { include: { beautyService: true } } },
    });
    if (!row) {
      throw new NotFoundException('Booking not found');
    }
    await this.beautyAccess.assertReadableTenantBeauty(actor, row.tenantId);
    return this.redactBooking(row);
  }

  async patch(actor: AuthUser, id: string, dto: PatchBeautyBookingDto, meta: FoodDiningRequestMeta) {
    const row = await this.prisma.beautyBooking.findFirst({ where: { id, deletedAt: null } });
    if (!row) {
      throw new NotFoundException('Booking not found');
    }
    await this.beautyAccess.assertCanOperateBranchBookings(actor, row.tenantId, row.branchId);

    const scheduledAt = dto.scheduledAt?.trim() ? new Date(dto.scheduledAt) : undefined;
    if (scheduledAt !== undefined) {
      if (Number.isNaN(scheduledAt.getTime())) {
        throw new BadRequestException('scheduledAt is not a valid date');
      }
      const branchForHours = await this.prisma.branch.findFirst({
        where: { id: row.branchId, tenantId: row.tenantId, deletedAt: null },
        select: { operatingHours: true, timezone: true },
      });
      assertScheduledAtFitsBranchOperatingHours(
        scheduledAt,
        branchForHours?.operatingHours ?? null,
        branchForHours?.timezone ?? null,
      );
    }

    const out = await this.prisma.beautyBooking.update({
      where: { id },
      data: {
        ...(dto.status != null ? { status: dto.status } : {}),
        ...(dto.staffId !== undefined ? { staffId: dto.staffId } : {}),
        ...(scheduledAt !== undefined ? { scheduledAt } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: { services: { include: { beautyService: true } } },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'BeautyBooking',
      entityId: id,
      tenantId: out.tenantId,
      branchId: out.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Beauty booking updated',
      changes: dto as object,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.redactBooking(out);
  }

  async checkIn(actor: AuthUser, id: string, meta: FoodDiningRequestMeta) {
    const row = await this.prisma.beautyBooking.findFirst({ where: { id, deletedAt: null } });
    if (!row) {
      throw new NotFoundException('Booking not found');
    }
    await this.beautyAccess.assertCanOperateBranchBookings(actor, row.tenantId, row.branchId);
    if (!['BOOKED', 'CONFIRMED'].includes(row.status)) {
      throw new BadRequestException('Only booked or confirmed visits can check in');
    }

    const out = await this.prisma.beautyBooking.update({
      where: { id },
      data: {
        status: 'CHECKED_IN',
        checkedInAt: new Date(),
      },
      include: { services: { include: { beautyService: true } } },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'BeautyBooking',
      entityId: id,
      tenantId: out.tenantId,
      branchId: out.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Beauty booking check-in',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.redactBooking(out);
  }

  async mintPortalToken(actor: AuthUser, id: string, meta: FoodDiningRequestMeta) {
    const row = await this.prisma.beautyBooking.findFirst({ where: { id, deletedAt: null } });
    if (!row) {
      throw new NotFoundException('Booking not found');
    }
    await this.beautyAccess.assertCanOperateBranchBookings(actor, row.tenantId, row.branchId);
    const rawToken = this.qrTokens.generateRawToken();
    const tokenHash = this.qrTokens.sha256Hex(rawToken);
    const createdAt = new Date();
    await this.prisma.beautyBooking.update({
      where: { id },
      data: { portalTokenHash: tokenHash, portalTokenCreatedAt: createdAt },
    });
    await this.audit.write({
      action: 'UPDATE',
      entityType: 'BeautyBooking',
      entityId: id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Beauty booking portal token minted',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return { id, rawToken, portalTokenCreatedAt: createdAt };
  }

  async revokePortalToken(actor: AuthUser, id: string, meta: FoodDiningRequestMeta) {
    const row = await this.prisma.beautyBooking.findFirst({ where: { id, deletedAt: null } });
    if (!row) {
      throw new NotFoundException('Booking not found');
    }
    await this.beautyAccess.assertCanOperateBranchBookings(actor, row.tenantId, row.branchId);
    await this.prisma.beautyBooking.update({
      where: { id },
      data: { portalTokenHash: null, portalTokenCreatedAt: null },
    });
    await this.audit.write({
      action: 'UPDATE',
      entityType: 'BeautyBooking',
      entityId: id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Beauty booking portal token revoked',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async getPublicBookingByPortalToken(rawToken: string) {
    const hash = this.qrTokens.sha256Hex(rawToken.trim());
    const row = await this.prisma.beautyBooking.findFirst({
      where: { portalTokenHash: hash, deletedAt: null },
      include: {
        branch: { select: { name: true, code: true } },
        services: {
          include: {
            beautyService: { select: { name: true } },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('Booking not found');
    }
    return {
      bookingNumber: row.bookingNumber,
      status: row.status,
      currency: row.currency,
      totalCents: row.totalCents,
      scheduledAt: row.scheduledAt,
      checkedInAt: row.checkedInAt,
      createdAt: row.createdAt,
      branch: { name: row.branch.name, code: row.branch.code },
      services: row.services.map((s) => ({
        name: s.beautyService.name,
        priceCents: s.priceCents,
        status: s.status,
      })),
    };
  }

  private async assertBookingMutable(booking: { status: BeautyBookingStatus }) {
    if (!OPEN_BOOKING_STATUSES.includes(booking.status)) {
      throw new BadRequestException('Booking cannot be modified in this status');
    }
  }

  async addService(actor: AuthUser, bookingId: string, dto: AddBeautyBookingServiceDto, meta: FoodDiningRequestMeta) {
    const row = await this.prisma.beautyBooking.findFirst({ where: { id: bookingId, deletedAt: null } });
    if (!row) {
      throw new NotFoundException('Booking not found');
    }
    await this.beautyAccess.assertCanOperateBranchBookings(actor, row.tenantId, row.branchId);
    await this.assertBookingMutable(row);

    const svc = await this.assertServiceForBranch(row.tenantId, row.branchId, dto.beautyServiceId);
    const line = await this.prisma.beautyBookingService.create({
      data: {
        bookingId: row.id,
        beautyServiceId: svc.id,
        staffId: dto.staffId ?? null,
        priceCents: svc.priceCents ?? 0,
        durationMin: svc.durationMin,
        notes: dto.notes?.trim(),
        status: 'PENDING',
      },
    });

    await this.prisma.beautyBooking.update({
      where: { id: row.id },
      data: { currency: svc.currency ?? row.currency },
    });
    await this.recomputeBookingTotal(this.prisma, row.id);

    await this.audit.write({
      action: 'CREATE',
      entityType: 'BeautyBookingService',
      entityId: line.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Booking service added',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.findOne(actor, bookingId);
  }

  async patchService(
    actor: AuthUser,
    bookingId: string,
    serviceId: string,
    dto: PatchBeautyBookingServiceDto,
    meta: FoodDiningRequestMeta,
  ) {
    const row = await this.prisma.beautyBooking.findFirst({ where: { id: bookingId, deletedAt: null } });
    if (!row) {
      throw new NotFoundException('Booking not found');
    }
    await this.beautyAccess.assertCanOperateBranchBookings(actor, row.tenantId, row.branchId);
    await this.assertBookingMutable(row);

    const line = await this.prisma.beautyBookingService.findFirst({
      where: { id: serviceId, bookingId },
    });
    if (!line) {
      throw new NotFoundException('Booking service line not found');
    }

    const startedAt = dto.startedAt?.trim() ? new Date(dto.startedAt) : undefined;
    const completedAt = dto.completedAt?.trim() ? new Date(dto.completedAt) : undefined;

    await this.prisma.beautyBookingService.update({
      where: { id: serviceId },
      data: {
        ...(dto.status != null ? { status: dto.status as BeautyBookingServiceStatus } : {}),
        ...(dto.staffId !== undefined ? { staffId: dto.staffId } : {}),
        ...(startedAt !== undefined ? { startedAt } : {}),
        ...(completedAt !== undefined ? { completedAt } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'BeautyBookingService',
      entityId: serviceId,
      tenantId: row.tenantId,
      branchId: row.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Booking service updated',
      changes: dto as object,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.findOne(actor, bookingId);
  }
}
