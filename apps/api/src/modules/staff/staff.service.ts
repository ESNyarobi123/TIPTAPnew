import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Staff } from '@prisma/client';
import { Prisma, RoleCode, type StaffAssignmentMode } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit-logs/audit.service';
import type { AuthUser } from '../auth/types/request-user.type';
import { userIsSuperAdmin } from '../auth/types/request-user.type';
import { ProviderRegistryService } from '../provider-registry/provider-registry.service';
import { TenantAccessService } from '../tenants/tenant-access.service';
import type { CreateStaffAssignmentDto } from './dto/create-staff-assignment.dto';
import type { CreateStaffCompensationDto } from './dto/create-staff-compensation.dto';
import type { CreateStaffDto } from './dto/create-staff.dto';
import type { CreateStaffJoinInviteDto } from './dto/create-staff-join-invite.dto';
import type { LinkProviderProfileDto } from './dto/link-provider-profile.dto';
import type { RedeemStaffJoinInviteDto } from './dto/redeem-staff-join-invite.dto';
import type { UpdateStaffAssignmentDto } from './dto/update-staff-assignment.dto';
import type { UpdateStaffCompensationDto } from './dto/update-staff-compensation.dto';
import type { UpdateStaffDto } from './dto/update-staff.dto';

export type StaffRequestMeta = {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
    private readonly audit: AuditService,
    private readonly providerRegistry: ProviderRegistryService,
  ) {}

  private mapStaff(s: Staff) {
    return {
      id: s.id,
      tenantId: s.tenantId,
      branchId: s.branchId,
      userId: s.userId,
      providerProfileId: s.providerProfileId,
      displayName: s.displayName,
      email: s.email,
      phone: s.phone,
      roleInTenant: s.roleInTenant,
      status: s.status,
      hireDate: s.hireDate,
      publicHandle: s.publicHandle,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }

  private mapStaffInternal(s: Staff) {
    return {
      ...this.mapStaff(s),
      privateNotes: s.privateNotes,
    };
  }

  private mapCompensation(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    staffId: string;
    type: string;
    status: string;
    amountCents: number;
    currency: string;
    periodLabel: string | null;
    periodStart: Date | null;
    periodEnd: Date | null;
    effectiveDate: Date;
    paidAt: Date | null;
    notes: string | null;
    createdByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
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
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async ensureUserRoleAssignment(
    userId: string,
    role: RoleCode,
    tenantId: string,
    branchId?: string | null,
  ) {
    const scopedBranchId = role === 'TENANT_OWNER' ? null : branchId ?? null;
    try {
      this.access.assertRoleAssignmentShape(role, tenantId, scopedBranchId);
    } catch {
      return;
    }
    const existing = await this.prisma.userRoleAssignment.findFirst({
      where: {
        userId,
        role,
        tenantId,
        branchId: scopedBranchId,
      },
      select: { id: true },
    });
    if (existing) {
      return;
    }
    await this.prisma.userRoleAssignment.create({
      data: {
        userId,
        role,
        tenantId,
        branchId: scopedBranchId,
      },
    });
  }

  private async syncUserRoleForStaff(
    staff: Pick<Staff, 'userId' | 'roleInTenant' | 'tenantId'>,
    branchId?: string | null,
  ) {
    if (!staff.userId) {
      return;
    }
    await this.ensureUserRoleAssignment(staff.userId, staff.roleInTenant, staff.tenantId, branchId);
  }

  private asDate(value?: string | Date | null): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date value');
    }
    return date;
  }

  private normalizedCurrency(value?: string | null): string {
    const currency = value?.trim().toUpperCase();
    return currency || 'TZS';
  }

  private async assertCanManageStaff(
    actor: AuthUser,
    tenantId: string,
    opts?: { branchId?: string | null },
  ): Promise<void> {
    if (userIsSuperAdmin(actor)) {
      return;
    }
    if (this.access.getOwnerTenantIds(actor).includes(tenantId)) {
      return;
    }
    const managed = this.access.getManagedBranchIds(actor);
    if (managed.length === 0) {
      throw new ForbiddenException('Cannot manage staff for this tenant');
    }
    if (opts?.branchId && managed.includes(opts.branchId)) {
      return;
    }
    if (!opts?.branchId && managed.length > 0) {
      const anyInTenant = await this.prisma.branch.count({
        where: { tenantId, id: { in: managed }, deletedAt: null },
      });
      if (anyInTenant > 0) {
        return;
      }
    }
    throw new ForbiddenException('Cannot manage staff for this tenant');
  }

  private async assertCanManageExistingStaff(actor: AuthUser, staffId: string): Promise<{
    tenantId: string;
  }> {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, deletedAt: null },
      include: {
        assignments: {
          where: { status: 'ACTIVE', endedAt: null },
        },
      },
    });
    if (!staff) {
      throw new NotFoundException('Staff not found');
    }
    if (userIsSuperAdmin(actor)) {
      return { tenantId: staff.tenantId };
    }
    if (this.access.getOwnerTenantIds(actor).includes(staff.tenantId)) {
      return { tenantId: staff.tenantId };
    }
    const managed = this.access.getManagedBranchIds(actor);
    const atHome = staff.branchId != null && managed.includes(staff.branchId);
    const viaAssign = staff.assignments.some((a) => managed.includes(a.branchId));
    if (atHome || viaAssign) {
      return { tenantId: staff.tenantId };
    }
    throw new ForbiddenException('Cannot manage this staff member');
  }

  async create(actor: AuthUser, dto: CreateStaffDto, meta: StaffRequestMeta) {
    await this.access.assertWritableTenant(actor, dto.tenantId);
    await this.assertCanManageStaff(actor, dto.tenantId, { branchId: dto.branchId ?? undefined });

    if (dto.branchId) {
      await this.access.assertBranchBelongsToTenant(dto.branchId, dto.tenantId);
    }
    if (dto.userId) {
      const u = await this.prisma.user.findFirst({
        where: { id: dto.userId, deletedAt: null },
      });
      if (!u) {
        throw new BadRequestException('userId not found');
      }
    }
    if (dto.providerProfileId) {
      const p = await this.prisma.providerProfile.findFirst({
        where: { id: dto.providerProfileId, deletedAt: null },
      });
      if (!p) {
        throw new BadRequestException('providerProfileId not found');
      }
    }

    const s = await this.prisma.staff.create({
      data: {
        tenantId: dto.tenantId,
        displayName: dto.displayName.trim(),
        roleInTenant: dto.roleInTenant ?? 'SERVICE_STAFF',
        status: dto.status ?? 'ACTIVE',
        branchId: dto.branchId,
        userId: dto.userId,
        providerProfileId: dto.providerProfileId,
        email: dto.email?.trim().toLowerCase(),
        phone: dto.phone?.trim(),
        publicHandle: dto.publicHandle?.trim(),
      },
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'Staff',
      entityId: s.id,
      tenantId: s.tenantId,
      branchId: s.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: `Created staff ${s.displayName}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await this.syncUserRoleForStaff(s, s.branchId);
    return this.mapStaff(s);
  }

  private parseBulkLines(lines: string): { displayName: string; phone: string }[] {
    const out: { displayName: string; phone: string }[] = [];
    for (const raw of lines.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      // Formats:
      // - "+2557xxxxxxx"
      // - "Name, +2557xxxxxxx"
      // - "Name +2557xxxxxxx"
      const parts = line.includes(',')
        ? line.split(',').map((x) => x.trim()).filter(Boolean)
        : line.split(/\s+/).map((x) => x.trim()).filter(Boolean);
      let phone = '';
      let name = '';
      if (parts.length === 1) {
        phone = parts[0];
      } else {
        phone = parts[parts.length - 1];
        name = parts.slice(0, -1).join(' ').trim();
      }
      const normalizedPhone = phone.replace(/\s/g, '');
      if (normalizedPhone.length < 7) continue;
      out.push({
        displayName: name || `Staff ${normalizedPhone.slice(-4)}`,
        phone: normalizedPhone,
      });
    }
    return out.slice(0, 500);
  }

  async bulkCreateAndLink(
    actor: AuthUser,
    dto: { tenantId: string; branchId: string; roleInTenant?: any; mode?: any; lines: string },
    meta: StaffRequestMeta,
  ) {
    await this.access.assertWritableTenant(actor, dto.tenantId);
    await this.assertCanManageStaff(actor, dto.tenantId, { branchId: dto.branchId });
    await this.access.assertBranchBelongsToTenant(dto.branchId, dto.tenantId);

    const parsed = this.parseBulkLines(dto.lines);
    if (!parsed.length) {
      throw new BadRequestException('No valid lines found');
    }

    const results: {
      created: { staffId: string; displayName: string; phone: string }[];
      skipped: { phone: string; reason: string }[];
      linked: { staffId: string; branchId: string; mode: string }[];
    } = { created: [], skipped: [], linked: [] };

    for (const row of parsed) {
      const existing = await this.prisma.staff.findFirst({
        where: { tenantId: dto.tenantId, phone: row.phone, deletedAt: null },
      });
      const staff =
        existing ??
        (await this.prisma.staff.create({
          data: {
            tenantId: dto.tenantId,
            displayName: row.displayName.trim(),
            phone: row.phone,
            roleInTenant: dto.roleInTenant ?? 'SERVICE_STAFF',
            status: 'ACTIVE',
          },
        }));
      if (!existing) {
        results.created.push({ staffId: staff.id, displayName: staff.displayName, phone: row.phone });
      }
      try {
        await this.createAssignment(
          actor,
          staff.id,
          { branchId: dto.branchId, mode: dto.mode } as any,
          meta,
        );
        results.linked.push({ staffId: staff.id, branchId: dto.branchId, mode: String(dto.mode ?? 'PART_TIME_SHARED') });
      } catch (e) {
        results.skipped.push({ phone: row.phone, reason: e instanceof Error ? e.message : 'Link failed' });
      }
    }

    return results;
  }

  async linkProviderProfile(
    actor: AuthUser,
    dto: LinkProviderProfileDto,
    meta: StaffRequestMeta,
  ) {
    await this.access.assertWritableTenant(actor, dto.tenantId);
    await this.assertCanManageStaff(actor, dto.tenantId, { branchId: dto.branchId });
    await this.access.assertBranchBelongsToTenant(dto.branchId, dto.tenantId);

    const profile = await this.providerRegistry.findByCodeOrSlug(dto.providerCode);
    const ownerUser = profile.userId
      ? await this.prisma.user.findFirst({
          where: { id: profile.userId, deletedAt: null },
          select: { id: true, email: true, phone: true },
        })
      : null;

    let staff = await this.prisma.staff.findFirst({
      where: {
        tenantId: dto.tenantId,
        providerProfileId: profile.id,
        deletedAt: null,
      },
    });

    let createdStaff = false;
    if (!staff && ownerUser?.id) {
      staff = await this.prisma.staff.findFirst({
        where: {
          tenantId: dto.tenantId,
          userId: ownerUser.id,
          deletedAt: null,
        },
      });
    }

    if (staff) {
      staff = await this.prisma.staff.update({
        where: { id: staff.id },
        data: {
          providerProfileId: staff.providerProfileId ?? profile.id,
          userId: staff.userId ?? ownerUser?.id ?? undefined,
          email: staff.email ?? ownerUser?.email ?? undefined,
          phone: staff.phone ?? ownerUser?.phone ?? undefined,
          displayName: staff.displayName || profile.displayName,
        },
      });
    } else {
      createdStaff = true;
      staff = await this.prisma.staff.create({
        data: {
          tenantId: dto.tenantId,
          displayName: profile.displayName,
          roleInTenant: dto.roleInTenant ?? 'SERVICE_STAFF',
          status: 'ACTIVE',
          userId: ownerUser?.id,
          providerProfileId: profile.id,
          email: ownerUser?.email ?? undefined,
          phone: ownerUser?.phone ?? undefined,
          publicHandle: profile.publicSlug ?? undefined,
        },
      });
    }

    const existingAssignment = await this.prisma.staffAssignment.findFirst({
      where: {
        staffId: staff.id,
        branchId: dto.branchId,
        status: 'ACTIVE',
        endedAt: null,
      },
    });
    const assignment = existingAssignment
      ? {
          id: existingAssignment.id,
          staffId: existingAssignment.staffId,
          branchId: existingAssignment.branchId,
          status: existingAssignment.status,
          mode: existingAssignment.mode,
          startedAt: existingAssignment.startedAt,
          endedAt: existingAssignment.endedAt,
        }
      : await this.createAssignment(
          actor,
          staff.id,
          { branchId: dto.branchId, mode: dto.mode } as CreateStaffAssignmentDto,
          meta,
        );

    return {
      createdStaff,
      createdAssignment: !existingAssignment,
      provider: {
        id: profile.id,
        registryCode: profile.registryCode,
        publicSlug: profile.publicSlug,
        displayName: profile.displayName,
      },
      staff: this.mapStaff(staff),
      assignment,
    };
  }

  async getMyWorkspace(actor: AuthUser) {
    const providerProfile = await this.prisma.providerProfile.findFirst({
      where: { userId: actor.userId, deletedAt: null },
    });

    const staffWhere: Prisma.StaffWhereInput = {
      deletedAt: null,
      OR: [
        { userId: actor.userId },
        ...(providerProfile ? [{ providerProfileId: providerProfile.id }] : []),
      ],
    };

    const staffRows = await this.prisma.staff.findMany({
      where: staffWhere,
      orderBy: { updatedAt: 'desc' },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            categories: {
              where: { enabled: true },
              select: { category: true },
            },
          },
        },
        branch: {
          select: { id: true, name: true },
        },
        assignments: {
          orderBy: { startedAt: 'desc' },
          take: 64,
          include: {
            branch: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    const staffIds = [...new Set(staffRows.map((row) => row.id))];

    const [recentTips, recentRatings, recentCompensations, links] = await Promise.all([
      staffIds.length
        ? this.prisma.tip.findMany({
            where: { staffId: { in: staffIds } },
            orderBy: { createdAt: 'desc' },
            take: 16,
            include: {
              branch: { select: { id: true, name: true } },
              staff: { select: { id: true, displayName: true } },
            },
          })
        : Promise.resolve([]),
      staffIds.length
        ? this.prisma.rating.findMany({
            where: { staffId: { in: staffIds }, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 16,
            include: {
              branch: { select: { id: true, name: true } },
              staff: { select: { id: true, displayName: true } },
            },
          })
        : Promise.resolve([]),
      staffIds.length
        ? this.prisma.staffCompensation.findMany({
            where: { staffId: { in: staffIds } },
            orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
            take: 16,
            include: {
              branch: { select: { id: true, name: true } },
              staff: { select: { id: true, displayName: true } },
            },
          })
        : Promise.resolve([]),
      Promise.all(
        staffRows.map(async (row) => {
          const [tipAll, tipCompleted, tipPendingCount, ratingStats, compensationAll, compensationPaid, compensationScheduled] =
            await Promise.all([
            this.prisma.tip.aggregate({
              where: { staffId: row.id },
              _sum: { amountCents: true },
              _count: { _all: true },
            }),
            this.prisma.tip.aggregate({
              where: { staffId: row.id, status: 'COMPLETED' },
              _sum: { amountCents: true },
            }),
            this.prisma.tip.count({
              where: { staffId: row.id, status: 'PENDING' },
            }),
            this.prisma.rating.aggregate({
              where: { staffId: row.id, deletedAt: null },
              _avg: { score: true },
              _count: { _all: true },
            }),
            this.prisma.staffCompensation.aggregate({
              where: { staffId: row.id },
              _sum: { amountCents: true },
              _count: { _all: true },
            }),
            this.prisma.staffCompensation.aggregate({
              where: { staffId: row.id, status: 'PAID' },
              _sum: { amountCents: true },
            }),
            this.prisma.staffCompensation.aggregate({
              where: { staffId: row.id, status: { in: ['SCHEDULED', 'APPROVED'] } },
              _sum: { amountCents: true },
            }),
          ]);

          const mappedAssignments = row.assignments.map((assignment) => ({
            id: assignment.id,
            branchId: assignment.branchId,
            branchName: assignment.branch.name,
            status: assignment.status,
            mode: assignment.mode,
            startedAt: assignment.startedAt,
            endedAt: assignment.endedAt,
          }));
          const activeAssignments = mappedAssignments.filter(
            (a) => a.status === 'ACTIVE' && a.endedAt == null,
          );
          const assignmentHistory = mappedAssignments
            .filter((a) => a.status === 'ENDED' || a.endedAt != null)
            .sort(
              (a, b) =>
                new Date(b.endedAt ?? b.startedAt).getTime() -
                new Date(a.endedAt ?? a.startedAt).getTime(),
            );

          return {
            staffId: row.id,
            displayName: row.displayName,
            roleInTenant: row.roleInTenant,
            status: row.status,
            publicHandle: row.publicHandle,
            tenantId: row.tenantId,
            tenantName: row.tenant.name,
            branchId: row.branchId,
            branchName: row.branch?.name ?? null,
            categories: row.tenant.categories.map((category) => category.category),
            activeAssignments,
            assignmentHistory,
            tipSummary: {
              totalCents: tipAll._sum.amountCents ?? 0,
              completedCents: tipCompleted._sum.amountCents ?? 0,
              totalCount: tipAll._count._all ?? 0,
              pendingCount: tipPendingCount,
            },
            ratingSummary: {
              averageScore: ratingStats._avg.score != null ? Number(ratingStats._avg.score) : null,
              totalCount: ratingStats._count._all ?? 0,
            },
            compensationSummary: {
              totalCents: compensationAll._sum.amountCents ?? 0,
              paidCents: compensationPaid._sum.amountCents ?? 0,
              scheduledCents: compensationScheduled._sum.amountCents ?? 0,
              totalCount: compensationAll._count._all ?? 0,
            },
          };
        }),
      ),
    ]);

    const ratingCount = links.reduce((sum, link) => sum + (link.ratingSummary.totalCount ?? 0), 0);
    const weightedRating = links.reduce(
      (sum, link) =>
        sum + (link.ratingSummary.averageScore ?? 0) * (link.ratingSummary.totalCount ?? 0),
      0,
    );

    return {
      providerProfile:
        providerProfile != null
          ? {
              id: providerProfile.id,
              registryCode: providerProfile.registryCode,
              displayName: providerProfile.displayName,
              headline: providerProfile.headline,
              bio: providerProfile.bio,
              verifiedSummary: providerProfile.verifiedSummary,
              publicRatingAvg: providerProfile.publicRatingAvg != null ? Number(providerProfile.publicRatingAvg) : null,
              publicRatingCount: providerProfile.publicRatingCount,
              skills:
                Array.isArray(providerProfile.skills) &&
                providerProfile.skills.every((item) => typeof item === 'string')
                  ? (providerProfile.skills as string[])
                  : [],
              publicSlug: providerProfile.publicSlug,
              internalNotes: providerProfile.internalNotes,
              createdAt: providerProfile.createdAt,
              updatedAt: providerProfile.updatedAt,
            }
          : null,
      summary: {
        linkedBusinesses: new Set(links.map((link) => link.tenantId)).size,
        activeAssignments: links.reduce((sum, link) => sum + link.activeAssignments.length, 0),
        totalTipsCents: links.reduce((sum, link) => sum + link.tipSummary.totalCents, 0),
        totalTipsCount: links.reduce((sum, link) => sum + link.tipSummary.totalCount, 0),
        totalCompensationCents: links.reduce((sum, link) => sum + link.compensationSummary.totalCents, 0),
        paidCompensationCents: links.reduce((sum, link) => sum + link.compensationSummary.paidCents, 0),
        scheduledCompensationCents: links.reduce((sum, link) => sum + link.compensationSummary.scheduledCents, 0),
        compensationCount: links.reduce((sum, link) => sum + link.compensationSummary.totalCount, 0),
        ratingAverage: ratingCount > 0 ? weightedRating / ratingCount : null,
        ratingCount,
        categories: [...new Set(links.flatMap((link) => link.categories))],
      },
      links,
      recentTips: recentTips.map((tip) => ({
        id: tip.id,
        staffId: tip.staffId,
        staffName: tip.staff.displayName,
        branchId: tip.branchId,
        branchName: tip.branch?.name ?? null,
        mode: tip.mode,
        status: tip.status,
        amountCents: tip.amountCents,
        currency: tip.currency,
        createdAt: tip.createdAt,
      })),
      recentRatings: recentRatings.map((rating) => ({
        id: rating.id,
        staffId: rating.staffId,
        staffName: rating.staff?.displayName ?? null,
        branchId: rating.branchId,
        branchName: rating.branch?.name ?? null,
        vertical: rating.vertical,
        targetType: rating.targetType,
        score: rating.score,
        maxScore: rating.maxScore,
        comment: rating.comment,
        createdAt: rating.createdAt,
      })),
      recentCompensations: recentCompensations.map((compensation) => ({
        id: compensation.id,
        staffId: compensation.staffId,
        staffName: compensation.staff.displayName,
        branchId: compensation.branchId,
        branchName: compensation.branch?.name ?? null,
        type: compensation.type,
        status: compensation.status,
        amountCents: compensation.amountCents,
        currency: compensation.currency,
        periodLabel: compensation.periodLabel,
        effectiveDate: compensation.effectiveDate,
        paidAt: compensation.paidAt,
        createdAt: compensation.createdAt,
      })),
    };
  }

  async findAll(actor: AuthUser, tenantId: string) {
    if (!tenantId?.trim()) {
      throw new BadRequestException('tenantId query is required');
    }
    await this.access.assertReadableTenant(actor, tenantId);
    if (userIsSuperAdmin(actor)) {
      const rows = await this.prisma.staff.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
      return rows.map((r) => this.mapStaff(r));
    }
    if (this.access.getOwnerTenantIds(actor).includes(tenantId)) {
      const rows = await this.prisma.staff.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((r) => this.mapStaff(r));
    }
    const managed = this.access.getManagedBranchIds(actor);
    const rows = await this.prisma.staff.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { branchId: { in: managed } },
          {
            assignments: {
              some: {
                branchId: { in: managed },
                status: 'ACTIVE',
                endedAt: null,
              },
            },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.mapStaff(r));
  }

  async search(actor: AuthUser, tenantId: string, q: string) {
    if (!tenantId?.trim()) {
      throw new BadRequestException('tenantId query is required');
    }
    const needle = q?.trim();
    if (!needle) {
      return [];
    }
    await this.access.assertReadableTenant(actor, tenantId);

    // Reuse same visibility rules as findAll.
    const isSuper = userIsSuperAdmin(actor);
    const isOwner = this.access.getOwnerTenantIds(actor).includes(tenantId);
    const managed = this.access.getManagedBranchIds(actor);

    const scopeOr =
      isSuper || isOwner
        ? undefined
        : managed.length
          ? {
              OR: [
                { branchId: { in: managed } },
                {
                  assignments: {
                    some: {
                      branchId: { in: managed },
                      status: 'ACTIVE',
                      endedAt: null,
                    },
                  },
                },
              ],
            }
          : { OR: [{ id: '__no_access__' }] };

    const where: Prisma.StaffWhereInput = {
      tenantId,
      deletedAt: null,
      ...(scopeOr ?? {}),
      OR: [
        { displayName: { contains: needle, mode: 'insensitive' } },
        { publicHandle: { contains: needle, mode: 'insensitive' } },
        { email: { contains: needle, mode: 'insensitive' } },
        { phone: { contains: needle, mode: 'insensitive' } },
      ],
    };

    const rows = await this.prisma.staff.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
    return rows.map((r) => this.mapStaff(r));
  }

  async findOne(actor: AuthUser, id: string) {
    await this.assertCanManageExistingStaff(actor, id);
    const s = await this.prisma.staff.findFirst({
      where: { id, deletedAt: null },
    });
    if (!s) {
      throw new NotFoundException('Staff not found');
    }
    return this.mapStaff(s);
  }

  async update(actor: AuthUser, id: string, dto: UpdateStaffDto, meta: StaffRequestMeta) {
    const { tenantId } = await this.assertCanManageExistingStaff(actor, id);
    const existing = await this.prisma.staff.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Staff not found');
    }
    if (dto.branchId) {
      await this.access.assertBranchBelongsToTenant(dto.branchId, tenantId);
    }
    if (dto.userId) {
      const u = await this.prisma.user.findFirst({
        where: { id: dto.userId, deletedAt: null },
      });
      if (!u) {
        throw new BadRequestException('userId not found');
      }
    }
    if (dto.providerProfileId) {
      const p = await this.prisma.providerProfile.findFirst({
        where: { id: dto.providerProfileId, deletedAt: null },
      });
      if (!p) {
        throw new BadRequestException('providerProfileId not found');
      }
    }

    const s = await this.prisma.staff.update({
      where: { id },
      data: {
        displayName: dto.displayName?.trim(),
        roleInTenant: dto.roleInTenant,
        status: dto.status,
        branchId: dto.branchId === undefined ? undefined : dto.branchId,
        userId: dto.userId === undefined ? undefined : dto.userId,
        providerProfileId:
          dto.providerProfileId === undefined ? undefined : dto.providerProfileId,
        email: dto.email === undefined ? undefined : dto.email?.trim().toLowerCase(),
        phone: dto.phone === undefined ? undefined : dto.phone?.trim(),
        publicHandle: dto.publicHandle === undefined ? undefined : dto.publicHandle?.trim(),
        privateNotes:
          dto.privateNotes === undefined ? undefined : dto.privateNotes?.trim(),
      },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'Staff',
      entityId: id,
      tenantId: s.tenantId,
      branchId: s.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: `Updated staff ${s.displayName}`,
      changes: dto as unknown as Prisma.InputJsonValue,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await this.syncUserRoleForStaff(s, s.branchId);
    return this.mapStaff(s);
  }

  async findOneInternal(actor: AuthUser, id: string) {
    await this.assertCanManageExistingStaff(actor, id);
    // Only SUPER_ADMIN and current employer managers should see internal notes.
    // Gate with same manage permission for now (TENANT_OWNER / BRANCH_MANAGER paths).
    const s = await this.prisma.staff.findFirst({
      where: { id, deletedAt: null },
    });
    if (!s) {
      throw new NotFoundException('Staff not found');
    }
    return this.mapStaffInternal(s);
  }

  async deactivate(actor: AuthUser, id: string, meta: StaffRequestMeta) {
    return this.update(actor, id, { status: 'INACTIVE' }, meta);
  }

  async remove(actor: AuthUser, id: string, meta: StaffRequestMeta) {
    const { tenantId } = await this.assertCanManageExistingStaff(actor, id);
    const existing = await this.prisma.staff.findFirst({
      where: { id, deletedAt: null },
      include: {
        assignments: {
          where: { status: 'ACTIVE', endedAt: null },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('Staff not found');
    }

    const removedAt = new Date();
    const endedAssignments = existing.assignments.length;

    await this.prisma.$transaction([
      this.prisma.staffAssignment.updateMany({
        where: { staffId: id, status: 'ACTIVE', endedAt: null },
        data: { status: 'ENDED', endedAt: removedAt },
      }),
      this.prisma.staff.update({
        where: { id },
        data: {
          status: 'INACTIVE',
          deletedAt: removedAt,
        },
      }),
    ]);

    await this.audit.write({
      action: 'DELETE',
      entityType: 'Staff',
      entityId: id,
      tenantId,
      branchId: existing.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: `Removed staff ${existing.displayName}`,
      details: {
        endedActiveAssignments: endedAssignments,
      } as Prisma.InputJsonValue,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      id,
      removed: true,
      removedAt,
      endedActiveAssignments: endedAssignments,
    };
  }

  private normalizeJoinInviteCode(raw: string): string {
    return raw.replace(/[\s-]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private formatJoinInviteCodeForDisplay(codeNormalized: string): string {
    if (codeNormalized.length <= 2) {
      return codeNormalized;
    }
    return `${codeNormalized.slice(0, 2)}-${codeNormalized.slice(2)}`;
  }

  private generateJoinInviteCodeNormalized(): string {
    const hex = randomBytes(4).toString('hex').toUpperCase();
    return `TT${hex}`;
  }

  /**
   * Create an active branch assignment when allowed; throw on full-time conflicts.
   * Returns `already_active` when an active assignment to the same branch already exists.
   */
  private async tryAttachBranchAssignment(
    tx: Prisma.TransactionClient,
    params: {
      staffId: string;
      branchId: string;
      mode: StaffAssignmentMode;
      startedAt?: Date;
    },
  ): Promise<{ outcome: 'created'; assignmentId: string } | { outcome: 'already_active' }> {
    const { staffId, branchId, mode, startedAt } = params;
    const existingActive = await tx.staffAssignment.findMany({
      where: {
        staffId,
        status: 'ACTIVE',
        endedAt: null,
      },
      take: 8,
    });

    if (mode === 'FULL_TIME_EXCLUSIVE' && existingActive.length > 0) {
      throw new ConflictException('Staff already has an active assignment and cannot be linked as exclusive');
    }

    if (existingActive.some((assignment) => assignment.mode === 'FULL_TIME_EXCLUSIVE')) {
      throw new ConflictException('Staff is already linked as full-time exclusive and must be unlinked first');
    }

    const dup = await tx.staffAssignment.findFirst({
      where: {
        staffId,
        branchId,
        status: 'ACTIVE',
        endedAt: null,
      },
    });
    if (dup) {
      return { outcome: 'already_active' };
    }

    const a = await tx.staffAssignment.create({
      data: {
        staffId,
        branchId,
        startedAt: startedAt ?? new Date(),
        status: 'ACTIVE',
        mode,
      },
    });
    return { outcome: 'created', assignmentId: a.id };
  }

  async createAssignment(
    actor: AuthUser,
    staffId: string,
    dto: CreateStaffAssignmentDto,
    meta: StaffRequestMeta,
  ) {
    const { tenantId } = await this.assertCanManageExistingStaff(actor, staffId);
    await this.access.assertBranchBelongsToTenant(dto.branchId, tenantId);
    await this.assertCanManageStaff(actor, tenantId, { branchId: dto.branchId });

    const mode = (dto.mode ?? 'PART_TIME_SHARED') as StaffAssignmentMode;
    const attach = await this.tryAttachBranchAssignment(this.prisma, {
      staffId,
      branchId: dto.branchId,
      mode,
      startedAt: dto.startedAt ?? undefined,
    });

    if (attach.outcome === 'already_active') {
      throw new ConflictException('Staff already has an active assignment to this branch');
    }

    const a = await this.prisma.staffAssignment.findFirstOrThrow({
      where: { id: attach.assignmentId },
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'StaffAssignment',
      entityId: a.id,
      tenantId,
      branchId: dto.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Staff branch assignment created',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, deletedAt: null },
      select: { userId: true, roleInTenant: true, tenantId: true },
    });
    if (staff) {
      await this.syncUserRoleForStaff(staff, dto.branchId);
    }

    return {
      id: a.id,
      staffId: a.staffId,
      branchId: a.branchId,
      status: a.status,
      mode: a.mode,
      startedAt: a.startedAt,
      endedAt: a.endedAt,
    };
  }

  async listAssignments(actor: AuthUser, staffId: string) {
    await this.assertCanManageExistingStaff(actor, staffId);
    const rows = await this.prisma.staffAssignment.findMany({
      where: { staffId },
      orderBy: { startedAt: 'desc' },
    });
    return rows.map((a) => ({
      id: a.id,
      staffId: a.staffId,
      branchId: a.branchId,
      status: a.status,
      mode: a.mode,
      startedAt: a.startedAt,
      endedAt: a.endedAt,
    }));
  }

  async listCompensations(actor: AuthUser, staffId: string) {
    await this.assertCanManageExistingStaff(actor, staffId);
    const rows = await this.prisma.staffCompensation.findMany({
      where: { staffId },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.mapCompensation(row));
  }

  async createCompensation(
    actor: AuthUser,
    staffId: string,
    dto: CreateStaffCompensationDto,
    meta: StaffRequestMeta,
  ) {
    const { tenantId } = await this.assertCanManageExistingStaff(actor, staffId);
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, deletedAt: null },
      select: { id: true, branchId: true, tenantId: true, displayName: true },
    });
    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    const branchId = dto.branchId?.trim() || staff.branchId || null;
    if (branchId) {
      await this.access.assertBranchBelongsToTenant(branchId, tenantId);
      await this.assertCanManageStaff(actor, tenantId, { branchId });
    }

    const status = dto.status ?? 'SCHEDULED';
    const effectiveDate = this.asDate(dto.effectiveDate) ?? new Date();
    const paidAt = this.asDate(dto.paidAt) ?? (status === 'PAID' ? effectiveDate : null);

    const row = await this.prisma.staffCompensation.create({
      data: {
        tenantId,
        branchId,
        staffId,
        type: dto.type ?? 'SALARY',
        status,
        amountCents: Math.max(0, Math.floor(dto.amountCents)),
        currency: this.normalizedCurrency(dto.currency),
        periodLabel: dto.periodLabel?.trim() || null,
        periodStart: this.asDate(dto.periodStart),
        periodEnd: this.asDate(dto.periodEnd),
        effectiveDate,
        paidAt,
        notes: dto.notes?.trim() || null,
        createdByUserId: actor.userId,
      },
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'StaffCompensation',
      entityId: row.id,
      tenantId,
      branchId: row.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: `Compensation created for ${staff.displayName}`,
      details: {
        type: row.type,
        status: row.status,
        amountCents: row.amountCents,
        currency: row.currency,
      } as Prisma.InputJsonValue,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.mapCompensation(row);
  }

  async updateCompensation(
    actor: AuthUser,
    staffId: string,
    compensationId: string,
    dto: UpdateStaffCompensationDto,
    meta: StaffRequestMeta,
  ) {
    const { tenantId } = await this.assertCanManageExistingStaff(actor, staffId);
    const existing = await this.prisma.staffCompensation.findFirst({
      where: {
        id: compensationId,
        staffId,
      },
    });
    if (!existing) {
      throw new NotFoundException('Compensation row not found');
    }

    const branchId = dto.branchId === undefined ? existing.branchId : dto.branchId?.trim() || null;
    if (branchId) {
      await this.access.assertBranchBelongsToTenant(branchId, tenantId);
      await this.assertCanManageStaff(actor, tenantId, { branchId });
    }

    const nextStatus = dto.status ?? existing.status;
    const nextEffectiveDate = this.asDate(dto.effectiveDate) ?? undefined;
    const nextPaidAt =
      dto.paidAt !== undefined
        ? this.asDate(dto.paidAt)
        : dto.status === 'PAID' && existing.paidAt == null
          ? new Date()
          : undefined;

    const updated = await this.prisma.staffCompensation.update({
      where: { id: compensationId },
      data: {
        branchId,
        type: dto.type ?? undefined,
        status: nextStatus === existing.status ? undefined : nextStatus,
        amountCents: dto.amountCents == null ? undefined : Math.max(0, Math.floor(dto.amountCents)),
        currency: dto.currency === undefined ? undefined : this.normalizedCurrency(dto.currency),
        periodLabel: dto.periodLabel === undefined ? undefined : dto.periodLabel?.trim() || null,
        periodStart: this.asDate(dto.periodStart),
        periodEnd: this.asDate(dto.periodEnd),
        effectiveDate: nextEffectiveDate,
        paidAt: nextPaidAt,
        notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
      },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'StaffCompensation',
      entityId: compensationId,
      tenantId,
      branchId: updated.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Compensation updated',
      changes: dto as unknown as Prisma.InputJsonValue,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.mapCompensation(updated);
  }

  async updateAssignment(
    actor: AuthUser,
    staffId: string,
    assignmentId: string,
    dto: UpdateStaffAssignmentDto,
    meta: StaffRequestMeta,
  ) {
    const { tenantId } = await this.assertCanManageExistingStaff(actor, staffId);
    const a = await this.prisma.staffAssignment.findFirst({
      where: { id: assignmentId, staffId },
      include: { branch: true },
    });
    if (!a) {
      throw new NotFoundException('Assignment not found');
    }
    if (a.branch.tenantId !== tenantId) {
      throw new BadRequestException('Assignment branch tenant mismatch');
    }
    await this.assertCanManageStaff(actor, tenantId, { branchId: a.branchId });

    const updated = await this.prisma.staffAssignment.update({
      where: { id: assignmentId },
      data: {
        endedAt: dto.endedAt ?? undefined,
        status: dto.status ?? undefined,
        mode: dto.mode ?? undefined,
      },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'StaffAssignment',
      entityId: assignmentId,
      tenantId,
      branchId: a.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Staff assignment updated',
      changes: dto as unknown as Prisma.InputJsonValue,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      id: updated.id,
      staffId: updated.staffId,
      branchId: updated.branchId,
      status: updated.status,
      mode: updated.mode,
      startedAt: updated.startedAt,
      endedAt: updated.endedAt,
    };
  }

  /** All compensation rows for the current user's staff profile(s) (provider workspace). */
  async listMyCompensations(actor: AuthUser) {
    const providerProfile = await this.prisma.providerProfile.findFirst({
      where: { userId: actor.userId, deletedAt: null },
    });
    const staffWhere: Prisma.StaffWhereInput = {
      deletedAt: null,
      OR: [
        { userId: actor.userId },
        ...(providerProfile ? [{ providerProfileId: providerProfile.id }] : []),
      ],
    };
    const staffRows = await this.prisma.staff.findMany({
      where: staffWhere,
      select: { id: true },
    });
    const ids = staffRows.map((r) => r.id);
    if (!ids.length) {
      return { items: [], total: 0 };
    }
    const rows = await this.prisma.staffCompensation.findMany({
      where: { staffId: { in: ids } },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
      include: {
        tenant: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        staff: { select: { id: true, displayName: true } },
      },
    });
    return {
      total: rows.length,
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
        tenantName: row.tenant.name,
        branchName: row.branch?.name ?? null,
        staffName: row.staff.displayName,
      })),
    };
  }

  async createJoinInvite(actor: AuthUser, dto: CreateStaffJoinInviteDto, meta: StaffRequestMeta) {
    await this.access.assertWritableTenant(actor, dto.tenantId);
    await this.assertCanManageStaff(actor, dto.tenantId, { branchId: dto.branchId });
    await this.access.assertBranchBelongsToTenant(dto.branchId, dto.tenantId);

    const role = (dto.roleInTenant ?? 'SERVICE_STAFF') as RoleCode;
    const maxUses = dto.maxUses ?? 1;
    const mode = (dto.mode ?? 'PART_TIME_SHARED') as StaffAssignmentMode;
    const expiresAt =
      dto.expiresInHours != null
        ? new Date(Date.now() + dto.expiresInHours * 60 * 60 * 1000)
        : null;

    let codeNormalized = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = this.generateJoinInviteCodeNormalized();
      const exists = await this.prisma.staffJoinInvite.findUnique({
        where: { codeNormalized: candidate },
        select: { id: true },
      });
      if (!exists) {
        codeNormalized = candidate;
        break;
      }
    }
    if (!codeNormalized) {
      throw new ConflictException('Could not allocate a unique join code — try again');
    }

    const row = await this.prisma.staffJoinInvite.create({
      data: {
        codeNormalized,
        tenantId: dto.tenantId,
        branchId: dto.branchId,
        roleInTenant: role,
        mode,
        maxUses,
        expiresAt,
        createdByUserId: actor.userId,
      },
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'StaffJoinInvite',
      entityId: row.id,
      tenantId: dto.tenantId,
      branchId: dto.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: `Created staff join code ${this.formatJoinInviteCodeForDisplay(codeNormalized)}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      id: row.id,
      code: this.formatJoinInviteCodeForDisplay(codeNormalized),
      codeNormalized,
      tenantId: row.tenantId,
      branchId: row.branchId,
      roleInTenant: row.roleInTenant,
      mode: row.mode,
      maxUses: row.maxUses,
      usesCount: row.usesCount,
      expiresAt: row.expiresAt,
    };
  }

  async listJoinInvites(actor: AuthUser, tenantId: string) {
    await this.access.assertReadableTenant(actor, tenantId);
    await this.assertCanManageStaff(actor, tenantId);

    const rows = await this.prisma.staffJoinInvite.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      code: this.formatJoinInviteCodeForDisplay(r.codeNormalized),
      branch: r.branch,
      roleInTenant: r.roleInTenant,
      mode: r.mode,
      maxUses: r.maxUses,
      usesCount: r.usesCount,
      expiresAt: r.expiresAt,
      revokedAt: r.revokedAt,
      createdAt: r.createdAt,
    }));
  }

  async revokeJoinInvite(actor: AuthUser, inviteId: string, meta: StaffRequestMeta) {
    const inv = await this.prisma.staffJoinInvite.findFirst({
      where: { id: inviteId },
    });
    if (!inv) {
      throw new NotFoundException('Invite not found');
    }
    await this.access.assertWritableTenant(actor, inv.tenantId);
    await this.assertCanManageStaff(actor, inv.tenantId, { branchId: inv.branchId });

    const updated = await this.prisma.staffJoinInvite.update({
      where: { id: inviteId },
      data: { revokedAt: new Date() },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'StaffJoinInvite',
      entityId: inviteId,
      tenantId: inv.tenantId,
      branchId: inv.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Revoked staff join code',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { id: updated.id, revokedAt: updated.revokedAt };
  }

  async redeemJoinInvite(actor: AuthUser, dto: RedeemStaffJoinInviteDto, meta: StaffRequestMeta) {
    const norm = this.normalizeJoinInviteCode(dto.code);
    if (norm.length < 10) {
      throw new BadRequestException('Invalid join code');
    }

    const profile = await this.prisma.providerProfile.findFirst({
      where: { userId: actor.userId, deletedAt: null },
    });
    if (!profile) {
      throw new BadRequestException(
        'Complete your provider profile first (onboarding), then redeem a join code.',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id: actor.userId, deletedAt: null },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const { invite, staff, assignment, consumedInvite } = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.staffJoinInvite.findUnique({
        where: { codeNormalized: norm },
        include: {
          tenant: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
      });
      if (!inv) {
        throw new NotFoundException('Join code not found');
      }
      if (inv.revokedAt) {
        throw new BadRequestException('This join code is no longer valid');
      }
      if (inv.expiresAt && inv.expiresAt.getTime() < Date.now()) {
        throw new BadRequestException('This join code has expired');
      }
      if (inv.usesCount >= inv.maxUses) {
        throw new BadRequestException('This join code has already been fully used');
      }

      let staffRow = await tx.staff.findFirst({
        where: {
          tenantId: inv.tenantId,
          deletedAt: null,
          OR: [{ userId: actor.userId }, { providerProfileId: profile.id }],
        },
      });

      if (staffRow) {
        staffRow = await tx.staff.update({
          where: { id: staffRow.id },
          data: {
            userId: staffRow.userId ?? actor.userId,
            providerProfileId: staffRow.providerProfileId ?? profile.id,
            displayName: staffRow.displayName?.trim() ? staffRow.displayName : profile.displayName,
            email: staffRow.email ?? user.email?.toLowerCase(),
            phone: staffRow.phone ?? user.phone ?? undefined,
            publicHandle: staffRow.publicHandle ?? profile.publicSlug ?? undefined,
            roleInTenant: inv.roleInTenant,
            status: 'ACTIVE',
          },
        });
      } else {
        staffRow = await tx.staff.create({
          data: {
            tenantId: inv.tenantId,
            displayName: profile.displayName,
            roleInTenant: inv.roleInTenant,
            status: 'ACTIVE',
            userId: actor.userId,
            providerProfileId: profile.id,
            email: user.email?.toLowerCase(),
            phone: user.phone ?? undefined,
            publicHandle: profile.publicSlug ?? undefined,
          },
        });
      }

      const attach = await this.tryAttachBranchAssignment(tx, {
        staffId: staffRow.id,
        branchId: inv.branchId,
        mode: inv.mode,
      });

      if (attach.outcome === 'created') {
        await tx.staffJoinInvite.update({
          where: { id: inv.id },
          data: { usesCount: { increment: 1 } },
        });
      }

      const assignmentRow =
        attach.outcome === 'created'
          ? await tx.staffAssignment.findFirstOrThrow({ where: { id: attach.assignmentId } })
          : await tx.staffAssignment.findFirstOrThrow({
              where: {
                staffId: staffRow.id,
                branchId: inv.branchId,
                status: 'ACTIVE',
                endedAt: null,
              },
            });

      return {
        invite: inv,
        staff: staffRow,
        assignment: assignmentRow,
        consumedInvite: attach.outcome === 'created',
      };
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'Staff',
      entityId: staff.id,
      tenantId: invite.tenantId,
      branchId: invite.branchId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: consumedInvite
        ? `Redeemed join code → ${invite.branch.name}`
        : `Join code OK (already assigned to ${invite.branch.name})`,
      details: { joinInviteId: invite.id } as Prisma.InputJsonValue,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await this.syncUserRoleForStaff(
      {
        userId: staff.userId,
        roleInTenant: staff.roleInTenant,
        tenantId: staff.tenantId,
      },
      invite.branchId,
    );

    return {
      consumedInvite,
      tenant: { id: invite.tenant.id, name: invite.tenant.name },
      branch: { id: invite.branch.id, name: invite.branch.name },
      staff: this.mapStaff(staff),
      assignment: {
        id: assignment.id,
        branchId: assignment.branchId,
        status: assignment.status,
        mode: assignment.mode,
      },
    };
  }
}
