import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  BeautyBookingStatus,
  DiningOrderStatus,
  Prisma,
  StaffCompensationStatus,
  StaffCompensationType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { AuthUser } from '../auth/types/request-user.type';
import { userIsSuperAdmin } from '../auth/types/request-user.type';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async metrics(user: AuthUser) {
    if (!userIsSuperAdmin(user)) {
      throw new ForbiddenException('SUPER_ADMIN required');
    }

    const end = new Date();
    const start24h = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    const start7d = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    const commissionRate = Math.max(
      0,
      Math.min(1, this.config.get<number>('admin.commissionRate') ?? 0.05),
    );

    const [
      userCount,
      staffCount,
      providerProfileCount,
      branchCount,
      tenantStatusGroups,
      roleGroups,
      categoryGroups,
      publishedLandingPages,
      activePaymentConfigs,
      payments24h,
      payments7d,
      failed24h,
      tips7d,
      qrTotal,
      qrActive,
      qrScanned24h,
      sessions24h,
      activeSessions24h,
      messages24h,
      audits24h,
      topTenantGroups,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.staff.count({ where: { deletedAt: null } }),
      this.prisma.providerProfile.count({ where: { deletedAt: null } }),
      this.prisma.branch.count({ where: { deletedAt: null } }),
      this.prisma.tenant.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: true,
      }),
      this.prisma.userRoleAssignment.groupBy({
        by: ['role'],
        _count: { _all: true },
      }),
      this.prisma.tenantCategory.groupBy({
        by: ['category'],
        where: { enabled: true },
        _count: { _all: true },
      }),
      this.prisma.tenantLandingPage.count({
        where: { deletedAt: null, isPublished: true },
      }),
      this.prisma.paymentProviderConfig.count({
        where: { isActive: true },
      }),
      this.prisma.paymentTransaction.aggregate({
        where: { status: 'COMPLETED', createdAt: { gte: start24h, lt: end } },
        _sum: { amountCents: true },
        _count: true,
      }),
      this.prisma.paymentTransaction.aggregate({
        where: { status: 'COMPLETED', createdAt: { gte: start7d, lt: end } },
        _sum: { amountCents: true },
        _count: true,
      }),
      this.prisma.paymentTransaction.count({
        where: { status: 'FAILED', createdAt: { gte: start24h, lt: end } },
      }),
      this.prisma.tip.aggregate({
        where: { status: 'COMPLETED', createdAt: { gte: start7d, lt: end } },
        _sum: { amountCents: true },
        _count: true,
      }),
      this.prisma.qrCode.count(),
      this.prisma.qrCode.count({
        where: { status: 'ACTIVE' },
      }),
      this.prisma.qrCode.count({
        where: { lastScannedAt: { gte: start24h, lt: end } },
      }),
      this.prisma.conversationSession.count({
        where: { deletedAt: null, createdAt: { gte: start24h, lt: end } },
      }),
      this.prisma.conversationSession.count({
        where: { deletedAt: null, lastActivityAt: { gte: start24h, lt: end } },
      }),
      this.prisma.conversationMessage.count({
        where: { createdAt: { gte: start24h, lt: end } },
      }),
      this.prisma.auditLog.count({
        where: { createdAt: { gte: start24h, lt: end } },
      }),
      this.prisma.paymentTransaction.groupBy({
        by: ['tenantId'],
        where: { status: 'COMPLETED', createdAt: { gte: start7d, lt: end } },
        _sum: { amountCents: true },
        _count: { _all: true },
        orderBy: { _sum: { amountCents: 'desc' } },
        take: 5,
      }),
    ]);

    const byStatus = Object.fromEntries(
      tenantStatusGroups.map((g) => [g.status, g._count]),
    );
    const rolesByCode = Object.fromEntries(roleGroups.map((g) => [g.role, g._count._all]));
    const categoriesEnabledByCode = Object.fromEntries(
      categoryGroups.map((g) => [g.category, g._count._all]),
    );
    const tenantsTotal = Object.values(byStatus).reduce((a, b) => a + Number(b), 0);

    const revenue24h = payments24h._sum?.amountCents ?? 0;
    const revenue7d = payments7d._sum?.amountCents ?? 0;
    const topTenantIds = topTenantGroups.map((row) => row.tenantId).filter(Boolean);
    const topTenants = topTenantIds.length
      ? await this.prisma.tenant.findMany({
          where: { id: { in: topTenantIds } },
          select: {
            id: true,
            name: true,
            status: true,
            _count: { select: { branches: true, staff: true } },
          },
        })
      : [];
    const topTenantMap = new Map(topTenants.map((tenant) => [tenant.id, tenant]));

    return {
      period: { start24h: start24h.toISOString(), start7d: start7d.toISOString(), end: end.toISOString() },
      tenants: {
        total: tenantsTotal,
        byStatus,
        topByVolume7d: topTenantGroups.map((row) => {
          const tenant = topTenantMap.get(row.tenantId);
          return {
            tenantId: row.tenantId,
            name: tenant?.name ?? row.tenantId,
            status: tenant?.status ?? null,
            branchCount: tenant?._count.branches ?? 0,
            staffCount: tenant?._count.staff ?? 0,
            paymentCount: row._count._all,
            amountCents: row._sum.amountCents ?? 0,
          };
        }),
      },
      users: { total: userCount, rolesByCode },
      staff: { total: staffCount, providerProfiles: providerProfileCount },
      branches: { total: branchCount },
      categories: { enabledByCode: categoriesEnabledByCode },
      landingPages: { published: publishedLandingPages },
      paymentConfigs: { active: activePaymentConfigs },
      payments: {
        completed24h: { count: payments24h._count, amountCents: revenue24h },
        completed7d: { count: payments7d._count, amountCents: revenue7d },
        failed24h: { count: failed24h },
      },
      tips: {
        completed7d: {
          count: tips7d._count,
          amountCents: tips7d._sum.amountCents ?? 0,
        },
      },
      qr: {
        total: qrTotal,
        active: qrActive,
        scanned24h: qrScanned24h,
      },
      conversations: {
        sessions24h,
        active24h: activeSessions24h,
        messages24h,
      },
      audits: {
        events24h: audits24h,
      },
      commission: {
        rate: commissionRate,
        estimated24hCents: Math.round(revenue24h * commissionRate),
        estimated7dCents: Math.round(revenue7d * commissionRate),
      },
    };
  }

  /**
   * Cross-tenant service staff directory (multi-tenant ops). SUPER_ADMIN only.
   */
  async listStaff(
    user: AuthUser,
    opts: { tenantId?: string; search?: string; page: number; pageSize: number },
  ) {
    if (!userIsSuperAdmin(user)) {
      throw new ForbiddenException('SUPER_ADMIN required');
    }
    const page = Math.max(1, opts.page);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize));
    const skip = (page - 1) * pageSize;

    const where: Prisma.StaffWhereInput = { deletedAt: null };
    const tid = opts.tenantId?.trim();
    if (tid) {
      where.tenantId = tid;
    }
    const q = opts.search?.trim();
    if (q) {
      where.OR = [
        { displayName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { publicHandle: { contains: q, mode: 'insensitive' } },
        { id: { equals: q } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.staff.count({ where }),
      this.prisma.staff.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: {
          tenant: { select: { id: true, name: true, status: true } },
          branch: { select: { id: true, name: true } },
          providerProfile: { select: { id: true, registryCode: true, publicSlug: true } },
        },
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        email: row.email,
        phone: row.phone,
        roleInTenant: row.roleInTenant,
        status: row.status,
        publicHandle: row.publicHandle,
        hireDate: row.hireDate,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        tenant: row.tenant,
        branch: row.branch,
        providerProfile: row.providerProfile,
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Cross-tenant dining orders (Food & Dining). SUPER_ADMIN only.
   */
  async listDiningOrders(
    user: AuthUser,
    opts: {
      tenantId?: string;
      branchId?: string;
      status?: DiningOrderStatus;
      search?: string;
      page: number;
      pageSize: number;
    },
  ) {
    if (!userIsSuperAdmin(user)) {
      throw new ForbiddenException('SUPER_ADMIN required');
    }
    const page = Math.max(1, opts.page);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize));
    const skip = (page - 1) * pageSize;

    const where: Prisma.DiningOrderWhereInput = { deletedAt: null };
    const tid = opts.tenantId?.trim();
    if (tid) {
      where.tenantId = tid;
    }
    const bid = opts.branchId?.trim();
    if (bid) {
      where.branchId = bid;
    }
    if (opts.status) {
      where.status = opts.status;
    }
    const q = opts.search?.trim();
    if (q) {
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q, mode: 'insensitive' } },
        { id: { equals: q } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.diningOrder.count({ where }),
      this.prisma.diningOrder.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { id: true, name: true, status: true } },
          branch: { select: { id: true, name: true } },
          staff: { select: { id: true, displayName: true } },
        },
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        branchId: row.branchId,
        orderNumber: row.orderNumber,
        status: row.status,
        subtotalCents: row.subtotalCents,
        taxCents: row.taxCents,
        totalCents: row.totalCents,
        currency: row.currency,
        customerPhone: row.customerPhone,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        tenant: row.tenant,
        branch: row.branch,
        staff: row.staff,
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Cross-tenant beauty bookings. SUPER_ADMIN only.
   */
  async listBeautyBookings(
    user: AuthUser,
    opts: {
      tenantId?: string;
      branchId?: string;
      status?: BeautyBookingStatus;
      search?: string;
      page: number;
      pageSize: number;
    },
  ) {
    if (!userIsSuperAdmin(user)) {
      throw new ForbiddenException('SUPER_ADMIN required');
    }
    const page = Math.max(1, opts.page);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize));
    const skip = (page - 1) * pageSize;

    const where: Prisma.BeautyBookingWhereInput = { deletedAt: null };
    const tid = opts.tenantId?.trim();
    if (tid) {
      where.tenantId = tid;
    }
    const bid = opts.branchId?.trim();
    if (bid) {
      where.branchId = bid;
    }
    if (opts.status) {
      where.status = opts.status;
    }
    const q = opts.search?.trim();
    if (q) {
      where.OR = [
        { bookingNumber: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { id: { equals: q } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.beautyBooking.count({ where }),
      this.prisma.beautyBooking.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { id: true, name: true, status: true } },
          branch: { select: { id: true, name: true } },
          station: { select: { id: true, code: true, label: true } },
          staff: { select: { id: true, displayName: true } },
        },
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        branchId: row.branchId,
        stationId: row.stationId,
        bookingNumber: row.bookingNumber,
        status: row.status,
        scheduledAt: row.scheduledAt,
        checkedInAt: row.checkedInAt,
        totalCents: row.totalCents,
        currency: row.currency,
        customerPhone: row.customerPhone,
        customerName: row.customerName,
        isWalkIn: row.isWalkIn,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        tenant: row.tenant,
        branch: row.branch,
        station: row.station
          ? {
              id: row.station.id,
              code: row.station.code,
              label: row.station.label,
            }
          : null,
        staff: row.staff,
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Cross-tenant staff compensation rows (salary, bonus, etc.). SUPER_ADMIN only.
   */
  async listCompensations(
    user: AuthUser,
    opts: {
      tenantId?: string;
      branchId?: string;
      status?: StaffCompensationStatus;
      type?: StaffCompensationType;
      search?: string;
      page: number;
      pageSize: number;
    },
  ) {
    if (!userIsSuperAdmin(user)) {
      throw new ForbiddenException('SUPER_ADMIN required');
    }
    const page = Math.max(1, opts.page);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize));
    const skip = (page - 1) * pageSize;

    const where: Prisma.StaffCompensationWhereInput = {};
    const tid = opts.tenantId?.trim();
    if (tid) {
      where.tenantId = tid;
    }
    const bid = opts.branchId?.trim();
    if (bid) {
      where.branchId = bid;
    }
    if (opts.status) {
      where.status = opts.status;
    }
    if (opts.type) {
      where.type = opts.type;
    }
    const q = opts.search?.trim();
    if (q) {
      where.OR = [
        { id: { equals: q } },
        { periodLabel: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        {
          staff: {
            deletedAt: null,
            displayName: { contains: q, mode: 'insensitive' },
          },
        },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.staffCompensation.count({ where }),
      this.prisma.staffCompensation.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          tenant: { select: { id: true, name: true, status: true } },
          branch: { select: { id: true, name: true } },
          staff: { select: { id: true, displayName: true, email: true } },
        },
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        branchId: row.branchId,
        staffId: row.staffId,
        type: row.type,
        status: row.status,
        amountCents: row.amountCents,
        currency: row.currency,
        periodLabel: row.periodLabel,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        effectiveDate: row.effectiveDate,
        paidAt: row.paidAt,
        notes: row.notes,
        createdAt: row.createdAt,
        tenant: row.tenant,
        branch: row.branch,
        staff: row.staff,
      })),
      total,
      page,
      pageSize,
    };
  }
}
