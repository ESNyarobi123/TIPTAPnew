import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  BeautyBookingStatus,
  DiningOrderStatus,
  PayrollLineKind,
  Prisma,
  TenantStatus,
  StaffCompensationStatus,
  StaffCompensationType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { AuthUser } from '../auth/types/request-user.type';
import { userIsSuperAdmin } from '../auth/types/request-user.type';
import type {
  ApprovalRiskLevel,
  ApprovalWorkflowState,
  UpdateTenantApprovalDto,
} from './dto/update-tenant-approval.dto';

const approvalChecklistKeys = [
  'legalIdentityVerified',
  'contactVerified',
  'paymentReady',
  'branchReady',
  'catalogReady',
  'staffingReady',
  'channelReady',
] as const;

type ApprovalChecklistKey = (typeof approvalChecklistKeys)[number];

type ApprovalChecklist = Record<ApprovalChecklistKey, boolean>;

type ParsedApproval = {
  workflowStatus: ApprovalWorkflowState;
  riskLevel: ApprovalRiskLevel;
  assignedReviewerUserId: string | null;
  reviewedByUserId: string | null;
  reviewNotes: string | null;
  nextActions: string | null;
  requestedAt: string | null;
  submittedAt: string | null;
  lastReviewedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  changesRequestedAt: string | null;
  checklist: ApprovalChecklist;
  readinessCompleted: number;
  readinessTotal: number;
  readinessPercent: number;
  timeline: Array<Record<string, unknown>>;
};

type UnifiedOrderRow = {
  id: string;
  kind: 'DINING_ORDER' | 'BEAUTY_BOOKING' | 'LEDGER_ONLY';
  vertical: 'FOOD_DINING' | 'BEAUTY_GROOMING' | 'LEDGER_ONLY';
  reference: string;
  workflowStatus: string;
  paymentStatus: string;
  commercialStatus: string;
  amountCents: number;
  currency: string;
  customerLabel: string | null;
  staffLabel: string | null;
  tenant: { id: string; name: string; status: string | null };
  branch: { id: string; name: string | null } | null;
  payment:
    | {
        id: string;
        orderReference: string;
        externalRef: string | null;
        status: string;
        type: string;
      }
    | null;
  createdAt: string;
  updatedAt: string;
};

const approvalWorkflowDefaults: Record<TenantStatus, ApprovalWorkflowState> = {
  ACTIVE: 'APPROVED',
  TRIAL: 'PENDING',
  SUSPENDED: 'CHANGES_REQUESTED',
  ARCHIVED: 'REJECTED',
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private assertSuperAdmin(user: AuthUser) {
    if (!userIsSuperAdmin(user)) {
      throw new ForbiddenException('SUPER_ADMIN required');
    }
  }

  private asObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private asString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private asTimeline(value: unknown): Array<Record<string, unknown>> {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row))
      .slice(0, 24);
  }

  private parseApproval(metadata: Prisma.JsonValue | null, tenantStatus: TenantStatus): ParsedApproval {
    const root = this.asObject(metadata);
    const approval = this.asObject(root.approval as Prisma.JsonValue | null);
    const checklistRaw = this.asObject(approval.checklist as Prisma.JsonValue | null);
    const checklist = Object.fromEntries(
      approvalChecklistKeys.map((key) => [key, Boolean(checklistRaw[key])]),
    ) as ApprovalChecklist;
    const readinessCompleted = approvalChecklistKeys.filter((key) => checklist[key]).length;
    const readinessTotal = approvalChecklistKeys.length;
    const workflowStatusRaw = this.asString(approval.workflowStatus);
    const riskLevelRaw = this.asString(approval.riskLevel);
    const workflowStatus = (
      workflowStatusRaw &&
      ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED'].includes(
        workflowStatusRaw,
      )
        ? workflowStatusRaw
        : approvalWorkflowDefaults[tenantStatus]
    ) as ApprovalWorkflowState;
    const riskLevel = (
      riskLevelRaw && ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(riskLevelRaw)
        ? riskLevelRaw
        : tenantStatus === 'TRIAL'
          ? 'MEDIUM'
          : 'LOW'
    ) as ApprovalRiskLevel;
    return {
      workflowStatus,
      riskLevel,
      assignedReviewerUserId: this.asString(approval.assignedReviewerUserId),
      reviewedByUserId: this.asString(approval.reviewedByUserId),
      reviewNotes: this.asString(approval.reviewNotes),
      nextActions: this.asString(approval.nextActions),
      requestedAt:
        this.asString(approval.requestedAt) ??
        this.asString(root.submittedAt) ??
        this.asString(root.requestedAt),
      submittedAt:
        this.asString(approval.submittedAt) ??
        this.asString(root.submittedAt) ??
        this.asString(root.requestedAt),
      lastReviewedAt: this.asString(approval.lastReviewedAt),
      approvedAt: this.asString(approval.approvedAt),
      rejectedAt: this.asString(approval.rejectedAt),
      changesRequestedAt: this.asString(approval.changesRequestedAt),
      checklist,
      readinessCompleted,
      readinessTotal,
      readinessPercent: Math.round((readinessCompleted / readinessTotal) * 100),
      timeline: this.asTimeline(approval.timeline),
    };
  }

  private deriveCommercialStatus(
    workflowStatus: string,
    paymentStatus: string,
  ): 'FULFILLMENT_ACTIVE' | 'AWAITING_PAYMENT' | 'CLOSED' | 'PAYMENT_ATTENTION' | 'CANCELLED' {
    const workflow = workflowStatus.toUpperCase();
    const payment = paymentStatus.toUpperCase();
    if (workflow.includes('CANCEL')) {
      return 'CANCELLED';
    }
    if (payment === 'FAILED' || payment === 'REFUNDED') {
      return 'PAYMENT_ATTENTION';
    }
    if (payment === 'COMPLETED' && ['COMPLETED', 'PAID'].includes(workflow)) {
      return 'CLOSED';
    }
    if (payment === 'COMPLETED') {
      return 'FULFILLMENT_ACTIVE';
    }
    if (['COMPLETED', 'PAID'].includes(workflow) && payment !== 'COMPLETED') {
      return 'AWAITING_PAYMENT';
    }
    return 'FULFILLMENT_ACTIVE';
  }

  async metrics(user: AuthUser) {
    this.assertSuperAdmin(user);

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
    this.assertSuperAdmin(user);
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
    this.assertSuperAdmin(user);
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
    this.assertSuperAdmin(user);
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
      lineKind?: PayrollLineKind;
      search?: string;
      page: number;
      pageSize: number;
    },
  ) {
    this.assertSuperAdmin(user);
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
    if (opts.lineKind) {
      where.lineKind = opts.lineKind;
    }
    const q = opts.search?.trim();
    if (q) {
      where.OR = [
        { id: { equals: q } },
        { periodLabel: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        { label: { contains: q, mode: 'insensitive' } },
        { sourceReference: { contains: q, mode: 'insensitive' } },
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
          payrollRun: { select: { id: true, status: true, periodLabel: true } },
          payrollSlip: { select: { id: true, slipNumber: true, status: true, netCents: true } },
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
        lineKind: row.lineKind,
        label: row.label,
        sourceReference: row.sourceReference,
        amountCents: row.amountCents,
        currency: row.currency,
        periodLabel: row.periodLabel,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        effectiveDate: row.effectiveDate,
        paidAt: row.paidAt,
        payrollRunId: row.payrollRunId,
        payrollSlipId: row.payrollSlipId,
        lockedAt: row.lockedAt,
        notes: row.notes,
        createdAt: row.createdAt,
        tenant: row.tenant,
        branch: row.branch,
        payrollRun: row.payrollRun,
        payrollSlip: row.payrollSlip,
        staff: row.staff,
      })),
      total,
      page,
      pageSize,
    };
  }

  async listApprovals(
    user: AuthUser,
    opts: {
      search?: string;
      tenantStatus?: TenantStatus;
      workflowStatus?: ApprovalWorkflowState;
      riskLevel?: ApprovalRiskLevel;
    },
  ) {
    this.assertSuperAdmin(user);

    const q = opts.search?.trim();
    const where: Prisma.TenantWhereInput = { deletedAt: null };
    if (opts.tenantStatus) {
      where.status = opts.tenantStatus;
    }
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { legalName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.tenant.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        categories: { select: { category: true, enabled: true } },
        landingPage: { select: { isPublished: true, slug: true, updatedAt: true } },
        userRoles: {
          where: { role: 'TENANT_OWNER' },
          select: {
            userId: true,
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
          take: 3,
        },
        branches: {
          where: { deletedAt: null },
          select: { id: true, name: true, code: true },
          orderBy: { createdAt: 'asc' },
          take: 2,
        },
        _count: {
          select: {
            branches: true,
            staff: true,
            paymentConfigs: true,
            diningOrders: true,
            beautyBookings: true,
          },
        },
      },
    });

    const items = rows
      .map((row) => {
        const approval = this.parseApproval(row.metadata, row.status);
        const primaryOwner = row.userRoles[0]?.user;
        const ownerName = [primaryOwner?.firstName, primaryOwner?.lastName].filter(Boolean).join(' ').trim();
        return {
          id: row.id,
          name: row.name,
          slug: row.slug,
          status: row.status,
          createdAt: row.createdAt,
          legalName: row.legalName,
          email: row.email,
          phone: row.phone,
          subscriptionPlan: row.subscriptionPlan,
          subscriptionStatus: row.subscriptionStatus,
          metadata: row.metadata,
          categories: row.categories.map((category) => category.category),
          owner:
            primaryOwner != null
              ? {
                  id: primaryOwner.id,
                  name: ownerName || primaryOwner.email,
                  email: primaryOwner.email,
                  phone: primaryOwner.phone,
                }
              : null,
          branchesPreview: row.branches,
          counts: {
            branches: row._count.branches,
            staff: row._count.staff,
            paymentConfigs: row._count.paymentConfigs,
            diningOrders: row._count.diningOrders,
            beautyBookings: row._count.beautyBookings,
          },
          landing:
            row.landingPage != null
              ? {
                  isPublished: row.landingPage.isPublished,
                  slug: row.landingPage.slug,
                  updatedAt: row.landingPage.updatedAt,
                }
              : null,
          approval,
        };
      })
      .filter((row) => {
        if (opts.workflowStatus && row.approval.workflowStatus !== opts.workflowStatus) {
          return false;
        }
        if (opts.riskLevel && row.approval.riskLevel !== opts.riskLevel) {
          return false;
        }
        return true;
      });

    const summary = {
      total: items.length,
      byTenantStatus: items.reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = (acc[row.status] ?? 0) + 1;
        return acc;
      }, {}),
      byWorkflowStatus: items.reduce<Record<string, number>>((acc, row) => {
        acc[row.approval.workflowStatus] = (acc[row.approval.workflowStatus] ?? 0) + 1;
        return acc;
      }, {}),
      byRiskLevel: items.reduce<Record<string, number>>((acc, row) => {
        acc[row.approval.riskLevel] = (acc[row.approval.riskLevel] ?? 0) + 1;
        return acc;
      }, {}),
      publishedLanding: items.filter((row) => row.landing?.isPublished).length,
      withPaymentsReady: items.filter((row) => row.approval.checklist.paymentReady).length,
    };

    return { summary, items };
  }

  async updateApproval(user: AuthUser, tenantId: string, dto: UpdateTenantApprovalDto) {
    this.assertSuperAdmin(user);

    const existing = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        status: true,
        metadata: true,
        createdAt: true,
      },
    });
    if (!existing || existing == null) {
      throw new NotFoundException('Tenant not found');
    }

    const nowIso = new Date().toISOString();
    const root = this.asObject(existing.metadata);
    const current = this.parseApproval(existing.metadata, existing.status);
    const currentApproval = this.asObject(root.approval as Prisma.JsonValue | null);
    const assignedReviewerUserId =
      dto.assignedReviewerUserId === undefined
        ? current.assignedReviewerUserId ?? user.userId
        : dto.assignedReviewerUserId;
    const workflowStatus = dto.workflowStatus ?? current.workflowStatus;
    const riskLevel = dto.riskLevel ?? current.riskLevel;
    const tenantStatus =
      dto.tenantStatus ??
      (workflowStatus === 'APPROVED'
        ? 'ACTIVE'
        : workflowStatus === 'REJECTED'
          ? 'ARCHIVED'
          : existing.status);

    const checklist: ApprovalChecklist = {
      legalIdentityVerified: dto.legalIdentityVerified ?? current.checklist.legalIdentityVerified,
      contactVerified: dto.contactVerified ?? current.checklist.contactVerified,
      paymentReady: dto.paymentReady ?? current.checklist.paymentReady,
      branchReady: dto.branchReady ?? current.checklist.branchReady,
      catalogReady: dto.catalogReady ?? current.checklist.catalogReady,
      staffingReady: dto.staffingReady ?? current.checklist.staffingReady,
      channelReady: dto.channelReady ?? current.checklist.channelReady,
    };

    const timeline = [
      {
        at: nowIso,
        byUserId: user.userId,
        workflowStatus,
        tenantStatus,
        riskLevel,
        note: this.asString(dto.reviewNotes) ?? current.reviewNotes,
      },
      ...current.timeline,
    ].slice(0, 12);

    const approvalPatch: Record<string, unknown> = {
      ...currentApproval,
      workflowStatus,
      riskLevel,
      assignedReviewerUserId,
      reviewedByUserId: user.userId,
      reviewNotes: this.asString(dto.reviewNotes) ?? current.reviewNotes,
      nextActions: this.asString(dto.nextActions) ?? current.nextActions,
      submittedAt: current.submittedAt ?? current.requestedAt ?? existing.createdAt.toISOString(),
      requestedAt: current.requestedAt ?? current.submittedAt ?? existing.createdAt.toISOString(),
      lastReviewedAt: nowIso,
      approvedAt:
        workflowStatus === 'APPROVED' ? nowIso : current.approvedAt,
      rejectedAt:
        workflowStatus === 'REJECTED' ? nowIso : current.rejectedAt,
      changesRequestedAt:
        workflowStatus === 'CHANGES_REQUESTED' ? nowIso : current.changesRequestedAt,
      checklist,
      timeline,
    };

    const metadata: Prisma.InputJsonValue = {
      ...root,
      approval: approvalPatch,
    } as Prisma.InputJsonValue;

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: tenantStatus,
        metadata,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: tenantId,
        actorUserId: user.userId,
        actorType: 'USER',
        action: 'UPDATE',
        entityType: 'TenantApproval',
        entityId: tenantId,
        summary: `Approval updated to ${workflowStatus}`,
        details: {
          tenantStatus,
          workflowStatus,
          riskLevel,
          checklist,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      tenantId: updated.id,
      status: updated.status,
      approval: this.parseApproval(updated.metadata, updated.status),
    };
  }

  async getOrderCenter(
    user: AuthUser,
    opts: {
      tenantId?: string;
      branchId?: string;
      kind?: string;
      workflowStatus?: string;
      paymentStatus?: string;
      commercialStatus?: string;
      search?: string;
      page: number;
      pageSize: number;
    },
  ) {
    this.assertSuperAdmin(user);

    const page = Math.max(1, opts.page);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize));
    const windowSize = Math.min(500, Math.max(120, page * pageSize * 4));
    const q = opts.search?.trim();

    const diningWhere: Prisma.DiningOrderWhereInput = { deletedAt: null };
    const beautyWhere: Prisma.BeautyBookingWhereInput = { deletedAt: null };
    const paymentWhere: Prisma.PaymentTransactionWhereInput = {
      type: { in: ['COLLECTION', 'TIP_DIGITAL'] },
    };

    if (opts.tenantId?.trim()) {
      diningWhere.tenantId = opts.tenantId.trim();
      beautyWhere.tenantId = opts.tenantId.trim();
      paymentWhere.tenantId = opts.tenantId.trim();
    }
    if (opts.branchId?.trim()) {
      diningWhere.branchId = opts.branchId.trim();
      beautyWhere.branchId = opts.branchId.trim();
      paymentWhere.branchId = opts.branchId.trim();
    }
    if (opts.workflowStatus?.trim()) {
      diningWhere.status = opts.workflowStatus as DiningOrderStatus;
      beautyWhere.status = opts.workflowStatus as BeautyBookingStatus;
    }
    if (q) {
      diningWhere.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q, mode: 'insensitive' } },
        { id: { equals: q } },
      ];
      beautyWhere.OR = [
        { bookingNumber: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { id: { equals: q } },
      ];
      paymentWhere.OR = [
        { orderReference: { contains: q, mode: 'insensitive' } },
        { externalRef: { contains: q, mode: 'insensitive' } },
        { id: { equals: q } },
      ];
    }

    const [diningOrders, beautyBookings, orphanLedgerRows] = await Promise.all([
      this.prisma.diningOrder.findMany({
        where: diningWhere,
        take: windowSize,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { id: true, name: true, status: true } },
          branch: { select: { id: true, name: true } },
          staff: { select: { displayName: true } },
          collectionPayment: {
            select: { id: true, orderReference: true, externalRef: true, status: true, type: true },
          },
        },
      }),
      this.prisma.beautyBooking.findMany({
        where: beautyWhere,
        take: windowSize,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { id: true, name: true, status: true } },
          branch: { select: { id: true, name: true } },
          staff: { select: { displayName: true } },
          collectionPayment: {
            select: { id: true, orderReference: true, externalRef: true, status: true, type: true },
          },
        },
      }),
      this.prisma.paymentTransaction.findMany({
        where: paymentWhere,
        take: windowSize,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { id: true, name: true, status: true } },
          branch: { select: { id: true, name: true } },
          diningOrderCollection: { select: { id: true } },
          beautyBookingCollection: { select: { id: true } },
        },
      }),
    ]);

    const diningIds = diningOrders.map((row) => row.id);
    const beautyIds = beautyBookings.map((row) => row.id);
    const metadataPayments =
      diningIds.length || beautyIds.length
        ? await this.prisma.paymentTransaction.findMany({
            where: {
              type: { in: ['COLLECTION', 'TIP_DIGITAL'] },
              OR: [
                ...diningIds.map((id) => ({ metadata: { path: ['diningOrderId'], equals: id } })),
                ...beautyIds.map((id) => ({ metadata: { path: ['beautyBookingId'], equals: id } })),
              ],
            },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              orderReference: true,
              externalRef: true,
              status: true,
              type: true,
              metadata: true,
              createdAt: true,
            },
          })
        : [];

    const latestPaymentByDiningId = new Map<string, typeof metadataPayments[number]>();
    const latestPaymentByBeautyId = new Map<string, typeof metadataPayments[number]>();

    for (const payment of metadataPayments) {
      const meta = this.asObject(payment.metadata);
      const diningOrderId = this.asString(meta.diningOrderId);
      const beautyBookingId = this.asString(meta.beautyBookingId);
      if (diningOrderId && !latestPaymentByDiningId.has(diningOrderId)) {
        latestPaymentByDiningId.set(diningOrderId, payment);
      }
      if (beautyBookingId && !latestPaymentByBeautyId.has(beautyBookingId)) {
        latestPaymentByBeautyId.set(beautyBookingId, payment);
      }
    }

    const linkedPaymentIds = new Set<string>();
    const rows: UnifiedOrderRow[] = [
      ...diningOrders.map((row) => {
        const payment = row.collectionPayment ?? latestPaymentByDiningId.get(row.id) ?? null;
        if (payment?.id) {
          linkedPaymentIds.add(payment.id);
        }
        const paymentStatus = payment?.status ?? (row.paidAt ? 'COMPLETED' : 'UNPAID');
        return {
          id: row.id,
          kind: 'DINING_ORDER' as const,
          vertical: 'FOOD_DINING' as const,
          reference: row.orderNumber,
          workflowStatus: row.status,
          paymentStatus,
          commercialStatus: this.deriveCommercialStatus(row.status, paymentStatus),
          amountCents: row.totalCents,
          currency: row.currency,
          customerLabel: row.customerPhone ?? null,
          staffLabel: row.staff?.displayName ?? null,
          tenant: {
            id: row.tenant.id,
            name: row.tenant.name,
            status: row.tenant.status,
          },
          branch: row.branch ? { id: row.branch.id, name: row.branch.name } : null,
          payment: payment
            ? {
                id: payment.id,
                orderReference: payment.orderReference,
                externalRef: payment.externalRef ?? null,
                status: payment.status,
                type: payment.type,
              }
            : null,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        };
      }),
      ...beautyBookings.map((row) => {
        const payment = row.collectionPayment ?? latestPaymentByBeautyId.get(row.id) ?? null;
        if (payment?.id) {
          linkedPaymentIds.add(payment.id);
        }
        const paymentStatus = payment?.status ?? (row.paidAt ? 'COMPLETED' : 'UNPAID');
        return {
          id: row.id,
          kind: 'BEAUTY_BOOKING' as const,
          vertical: 'BEAUTY_GROOMING' as const,
          reference: row.bookingNumber,
          workflowStatus: row.status,
          paymentStatus,
          commercialStatus: this.deriveCommercialStatus(row.status, paymentStatus),
          amountCents: row.totalCents,
          currency: row.currency,
          customerLabel: row.customerName ?? row.customerPhone ?? null,
          staffLabel: row.staff?.displayName ?? null,
          tenant: {
            id: row.tenant.id,
            name: row.tenant.name,
            status: row.tenant.status,
          },
          branch: row.branch ? { id: row.branch.id, name: row.branch.name } : null,
          payment: payment
            ? {
                id: payment.id,
                orderReference: payment.orderReference,
                externalRef: payment.externalRef ?? null,
                status: payment.status,
                type: payment.type,
              }
            : null,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        };
      }),
      ...orphanLedgerRows
        .filter((payment) => {
          if (payment.id && linkedPaymentIds.has(payment.id)) {
            return false;
          }
          const meta = this.asObject(payment.metadata);
          if (this.asString(meta.diningOrderId) || this.asString(meta.beautyBookingId)) {
            return false;
          }
          if (payment.diningOrderCollection || payment.beautyBookingCollection) {
            return false;
          }
          return true;
        })
        .map((payment) => ({
          id: payment.id,
          kind: 'LEDGER_ONLY' as const,
          vertical: 'LEDGER_ONLY' as const,
          reference: payment.orderReference,
          workflowStatus: 'LEDGER_ONLY',
          paymentStatus: payment.status,
          commercialStatus:
            payment.status === 'COMPLETED' ? 'CLOSED' : payment.status === 'FAILED' ? 'PAYMENT_ATTENTION' : 'AWAITING_PAYMENT',
          amountCents: payment.amountCents,
          currency: payment.currency,
          customerLabel: payment.phoneNumber ?? null,
          staffLabel: null,
          tenant: {
            id: payment.tenant.id,
            name: payment.tenant.name,
            status: payment.tenant.status,
          },
          branch: payment.branch ? { id: payment.branch.id, name: payment.branch.name } : null,
          payment: {
            id: payment.id,
            orderReference: payment.orderReference,
            externalRef: payment.externalRef ?? null,
            status: payment.status,
            type: payment.type,
          },
          createdAt: payment.createdAt.toISOString(),
          updatedAt: payment.updatedAt.toISOString(),
        })),
    ]
      .filter((row) => !opts.kind || opts.kind === 'ALL' || row.kind === opts.kind)
      .filter((row) => !opts.paymentStatus || row.paymentStatus === opts.paymentStatus)
      .filter((row) => !opts.commercialStatus || row.commercialStatus === opts.commercialStatus)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const items = rows.slice(start, start + pageSize);

    return {
      summary: {
        total,
        byKind: rows.reduce<Record<string, number>>((acc, row) => {
          acc[row.kind] = (acc[row.kind] ?? 0) + 1;
          return acc;
        }, {}),
        byCommercialStatus: rows.reduce<Record<string, number>>((acc, row) => {
          acc[row.commercialStatus] = (acc[row.commercialStatus] ?? 0) + 1;
          return acc;
        }, {}),
        byPaymentStatus: rows.reduce<Record<string, number>>((acc, row) => {
          acc[row.paymentStatus] = (acc[row.paymentStatus] ?? 0) + 1;
          return acc;
        }, {}),
        grossCents: rows.reduce((sum, row) => sum + row.amountCents, 0),
      },
      items,
      total,
      page,
      pageSize,
      windowed: true,
    };
  }
}
