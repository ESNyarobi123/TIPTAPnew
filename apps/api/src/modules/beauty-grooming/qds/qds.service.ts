import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { BeautyBookingStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditService } from '../../audit-logs/audit.service';
import type { AuthUser } from '../../auth/types/request-user.type';
import { TenantAccessService } from '../../tenants/tenant-access.service';
import { QrTokenService } from '../../qr/qr-token.service';
import { BeautyGroomingAccessService } from '../beauty-grooming-access.service';
import type { FoodDiningRequestMeta } from '../../food-dining/menu-categories/menu-categories.service';
import type { CreateQdsTokenDto } from './dto/create-qds-token.dto';
import type { PatchQdsBookingDto } from './dto/patch-qds-booking.dto';

@Injectable()
export class QdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly beautyAccess: BeautyGroomingAccessService,
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

  async createToken(actor: AuthUser, dto: CreateQdsTokenDto, meta: FoodDiningRequestMeta) {
    await this.beautyAccess.assertCanManageBranchRow(actor, dto.tenantId, dto.branchId);
    await this.access.assertBranchBelongsToTenant(dto.branchId, dto.tenantId);

    const rawToken = this.qrTokens.generateRawToken();
    const tokenHash = this.qrTokens.sha256Hex(rawToken);
    const expiresAt = dto.expiresAt?.trim() ? new Date(dto.expiresAt) : null;
    const createdByStaffId = await this.staffIdForActor(dto.tenantId, actor);

    const row = await this.prisma.qdsToken.create({
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
      entityType: 'QdsToken',
      entityId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'QDS token created',
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
    const tid = await this.beautyAccess.resolveTenantId(actor, tenantId);
    await this.beautyAccess.assertReadableTenantBeauty(actor, tid);
    return this.prisma.qdsToken.findMany({
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
    const row = await this.prisma.qdsToken.findFirst({ where: { id } });
    if (!row) {
      throw new NotFoundException('QDS token not found');
    }
    await this.beautyAccess.assertCanManageBranchRow(actor, row.tenantId, row.branchId);

    const updated = await this.prisma.qdsToken.update({
      where: { id },
      data: { isActive: false, revokedAt: new Date() },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'QdsToken',
      entityId: id,
      tenantId: updated.tenantId,
      branchId: updated.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'QDS token revoked',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  async resolveToken(rawToken: string) {
    const hash = this.qrTokens.sha256Hex(rawToken.trim());
    const row = await this.prisma.qdsToken.findFirst({
      where: { tokenHash: hash },
    });
    if (!row || !row.isActive || row.revokedAt) {
      throw new UnauthorizedException('Invalid or revoked queue token');
    }
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Queue token expired');
    }
    return row;
  }

  async getQueue(rawToken: string) {
    const t = await this.resolveToken(rawToken);
    const base = {
      tenantId: t.tenantId,
      branchId: t.branchId,
      deletedAt: null,
    };
    const [waiting, inService, upcoming] = await Promise.all([
      this.prisma.beautyBooking.findMany({
        where: { ...base, status: 'CHECKED_IN' },
        orderBy: { checkedInAt: 'asc' },
        take: 80,
        include: {
          services: { include: { beautyService: { select: { id: true, name: true } } } },
          station: { select: { id: true, code: true, label: true } },
        },
      }),
      this.prisma.beautyBooking.findMany({
        where: { ...base, status: 'IN_SERVICE' },
        orderBy: { updatedAt: 'desc' },
        take: 40,
        include: {
          services: { include: { beautyService: { select: { id: true, name: true } } } },
          station: { select: { id: true, code: true, label: true } },
          staff: { select: { id: true, displayName: true } },
        },
      }),
      this.prisma.beautyBooking.findMany({
        where: {
          ...base,
          status: { in: ['BOOKED', 'CONFIRMED'] },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 40,
        include: {
          services: { include: { beautyService: { select: { id: true, name: true } } } },
        },
      }),
    ]);
    return { waiting, inService, upcoming };
  }

  async getProviders(rawToken: string) {
    const t = await this.resolveToken(rawToken);
    const staff = await this.prisma.staff.findMany({
      where: {
        tenantId: t.tenantId,
        deletedAt: null,
        assignments: {
          some: {
            branchId: t.branchId,
            status: 'ACTIVE',
          },
        },
      },
      select: {
        id: true,
        displayName: true,
        phone: true,
        roleInTenant: true,
      },
      take: 100,
      orderBy: { displayName: 'asc' },
    });
    return { branchId: t.branchId, providers: staff };
  }

  async patchBooking(rawToken: string, bookingId: string, dto: PatchQdsBookingDto) {
    const t = await this.resolveToken(rawToken);
    const booking = await this.prisma.beautyBooking.findFirst({
      where: { id: bookingId, tenantId: t.tenantId, branchId: t.branchId, deletedAt: null },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    this.assertAllowedQdsTransition(booking.status, dto.status);
    return this.prisma.beautyBooking.update({
      where: { id: bookingId },
      data: { status: dto.status },
      include: {
        services: { include: { beautyService: { select: { id: true, name: true } } } },
        station: { select: { id: true, code: true } },
      },
    });
  }

  private assertAllowedQdsTransition(from: BeautyBookingStatus, to: BeautyBookingStatus) {
    const allowed: BeautyBookingStatus[] = [
      'BOOKED',
      'CONFIRMED',
      'CHECKED_IN',
      'IN_SERVICE',
      'COMPLETED',
      'PAID',
      'CANCELLED',
      'NO_SHOW',
    ];
    if (!allowed.includes(to)) {
      throw new BadRequestException('Invalid status');
    }
    if (from === 'PAID' || from === 'CANCELLED' || from === 'NO_SHOW') {
      throw new BadRequestException('Booking is closed');
    }
  }
}
