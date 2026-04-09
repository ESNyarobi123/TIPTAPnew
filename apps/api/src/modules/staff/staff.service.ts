import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Staff } from '@prisma/client';
import {
  PayrollDisbursementMethod,
  PayrollLineKind,
  PayrollRunStatus,
  PayrollSlipStatus,
  Prisma,
  RoleCode,
  StaffCompensationStatus,
  StaffCompensationType,
  type StaffAssignmentMode,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit-logs/audit.service';
import type { AuthUser } from '../auth/types/request-user.type';
import { userIsSuperAdmin } from '../auth/types/request-user.type';
import { ProviderRegistryService } from '../provider-registry/provider-registry.service';
import { TenantAccessService } from '../tenants/tenant-access.service';
import type { CreateStaffAssignmentDto } from './dto/create-staff-assignment.dto';
import type { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import type { CreateStaffCompensationDto } from './dto/create-staff-compensation.dto';
import type { CreateStaffDto } from './dto/create-staff.dto';
import type { CreateStaffJoinInviteDto } from './dto/create-staff-join-invite.dto';
import type { LinkProviderProfileDto } from './dto/link-provider-profile.dto';
import type { RecordPayrollDisbursementDto } from './dto/record-payroll-disbursement.dto';
import type { RedeemStaffJoinInviteDto } from './dto/redeem-staff-join-invite.dto';
import type { UpdateStaffAssignmentDto } from './dto/update-staff-assignment.dto';
import type { UpdatePayrollRunStatusDto } from './dto/update-payroll-run-status.dto';
import type { UpdateStaffCompensationDto } from './dto/update-staff-compensation.dto';
import type { UpdateStaffDto } from './dto/update-staff.dto';

export type StaffRequestMeta = {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

type CompensationLike = {
  id: string;
  tenantId: string;
  branchId: string | null;
  staffId: string;
  type: string;
  status: string;
  lineKind: string | null;
  label: string | null;
  sourceReference: string | null;
  amountCents: number;
  currency: string;
  periodLabel: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  effectiveDate: Date;
  paidAt: Date | null;
  notes: string | null;
  payrollRunId: string | null;
  payrollSlipId: string | null;
  lockedAt: Date | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PayrollTotals = {
  grossCents: number;
  deductionCents: number;
  netCents: number;
  baseSalaryCents: number;
  allowanceCents: number;
  commissionCents: number;
  bonusCents: number;
  tipShareCents: number;
  overtimeCents: number;
  serviceChargeCents: number;
  adjustmentCents: number;
  advanceRecoveryCents: number;
  otherDeductionCents: number;
};

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
    private readonly audit: AuditService,
    private readonly providerRegistry: ProviderRegistryService,
  ) {}

  private mapStaff(s: Staff & { providerProfile?: { registryCode: string | null } | null }) {
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
      providerRegistryCode: s.providerProfile?.registryCode ?? null,
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

  private mapCompensation(row: CompensationLike) {
    return {
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
      notes: row.notes,
      payrollRunId: row.payrollRunId,
      payrollSlipId: row.payrollSlipId,
      lockedAt: row.lockedAt,
      locked: Boolean(row.lockedAt),
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapPayrollRun(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    status: string;
    currency: string;
    periodLabel: string;
    periodStart: Date;
    periodEnd: Date;
    notes: string | null;
    createdByUserId: string | null;
    approvedByUserId: string | null;
    approvedAt: Date | null;
    paidAt: Date | null;
    reconciledAt: Date | null;
    voidedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    slips?: Array<{
      id: string;
      staffId: string;
      status: string;
      grossCents: number;
      deductionCents: number;
      netCents: number;
    }>;
  }) {
    const slips = row.slips ?? [];
    return {
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      status: row.status,
      currency: row.currency,
      periodLabel: row.periodLabel,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      notes: row.notes,
      createdByUserId: row.createdByUserId,
      approvedByUserId: row.approvedByUserId,
      approvedAt: row.approvedAt,
      paidAt: row.paidAt,
      reconciledAt: row.reconciledAt,
      voidedAt: row.voidedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      summary: {
        slipCount: slips.length,
        staffCount: new Set(slips.map((slip) => slip.staffId)).size,
        grossCents: slips.reduce((sum, slip) => sum + slip.grossCents, 0),
        deductionCents: slips.reduce((sum, slip) => sum + slip.deductionCents, 0),
        netCents: slips.reduce((sum, slip) => sum + slip.netCents, 0),
        paidCount: slips.filter((slip) => slip.status === 'PAID' || slip.status === 'RECONCILED').length,
      },
    };
  }

  private mapPayrollSlip(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    staffId: string;
    payrollRunId: string | null;
    slipNumber: string;
    status: string;
    currency: string;
    periodLabel: string;
    periodStart: Date;
    periodEnd: Date;
    effectiveDate: Date;
    grossCents: number;
    deductionCents: number;
    netCents: number;
    baseSalaryCents: number;
    allowanceCents: number;
    commissionCents: number;
    bonusCents: number;
    tipShareCents: number;
    overtimeCents: number;
    serviceChargeCents: number;
    adjustmentCents: number;
    advanceRecoveryCents: number;
    otherDeductionCents: number;
    paidAt: Date | null;
    notes: string | null;
    createdByUserId: string | null;
    approvedByUserId: string | null;
    approvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    staff?: {
      id: string;
      displayName: string;
      email: string | null;
      phone: string | null;
      providerProfile?: {
        registryCode: string | null;
        payoutProfile: Prisma.JsonValue | null;
      } | null;
    } | null;
    tenant?: { id: string; name: string } | null;
    branch?: { id: string; name: string | null; code: string } | null;
    payrollRun?: { id: string; status: string } | null;
    compensationRows?: CompensationLike[];
    disbursements?: Array<{
      id: string;
      method: string;
      status: string;
      amountCents: number;
      reference: string | null;
      accountMask: string | null;
      recipientLabel: string | null;
      proofNote: string | null;
      externalTransactionId: string | null;
      recordedByUserId: string | null;
      recordedAt: Date;
      createdAt: Date;
    }>;
  }) {
    const providerProfilePayload =
      row.staff?.providerProfile &&
      typeof row.staff.providerProfile === 'object' &&
      !Array.isArray(row.staff.providerProfile)
        ? (row.staff.providerProfile as Record<string, unknown>)
        : null;
    const payoutProfilePayload =
      providerProfilePayload?.payoutProfile &&
      typeof providerProfilePayload.payoutProfile === 'object' &&
      !Array.isArray(providerProfilePayload.payoutProfile)
        ? (providerProfilePayload.payoutProfile as Record<string, unknown>)
        : null;

    return {
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      staffId: row.staffId,
      payrollRunId: row.payrollRunId,
      slipNumber: row.slipNumber,
      status: row.status,
      currency: row.currency,
      periodLabel: row.periodLabel,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      effectiveDate: row.effectiveDate,
      grossCents: row.grossCents,
      deductionCents: row.deductionCents,
      netCents: row.netCents,
      baseSalaryCents: row.baseSalaryCents,
      allowanceCents: row.allowanceCents,
      commissionCents: row.commissionCents,
      bonusCents: row.bonusCents,
      tipShareCents: row.tipShareCents,
      overtimeCents: row.overtimeCents,
      serviceChargeCents: row.serviceChargeCents,
      adjustmentCents: row.adjustmentCents,
      advanceRecoveryCents: row.advanceRecoveryCents,
      otherDeductionCents: row.otherDeductionCents,
      paidAt: row.paidAt,
      notes: row.notes,
      createdByUserId: row.createdByUserId,
      approvedByUserId: row.approvedByUserId,
      approvedAt: row.approvedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      staff: row.staff
        ? {
            ...row.staff,
            providerProfile: row.staff.providerProfile
              ? {
                  registryCode:
                    typeof providerProfilePayload?.registryCode === 'string'
                      ? providerProfilePayload.registryCode
                      : null,
                  payoutProfile: payoutProfilePayload
                      ? {
                          method:
                            typeof payoutProfilePayload.method === 'string'
                              ? payoutProfilePayload.method
                              : null,
                          recipientLabel:
                            typeof payoutProfilePayload.recipientLabel === 'string'
                              ? payoutProfilePayload.recipientLabel
                              : null,
                          accountMask:
                            typeof payoutProfilePayload.accountMask === 'string'
                              ? payoutProfilePayload.accountMask
                              : null,
                          note:
                            typeof payoutProfilePayload.note === 'string'
                              ? payoutProfilePayload.note
                              : null,
                        }
                      : null,
                }
              : null,
          }
        : null,
      tenant: row.tenant ?? null,
      branch: row.branch ?? null,
      payrollRun: row.payrollRun ?? null,
      compensationRows: (row.compensationRows ?? []).map((line) => this.mapCompensation(line)),
      disbursements: (row.disbursements ?? []).map((d) => ({
        id: d.id,
        method: d.method,
        status: d.status,
        amountCents: d.amountCents,
        reference: d.reference,
        accountMask: d.accountMask,
        recipientLabel: d.recipientLabel,
        proofNote: d.proofNote,
        externalTransactionId: d.externalTransactionId,
        recordedByUserId: d.recordedByUserId,
        recordedAt: d.recordedAt,
        createdAt: d.createdAt,
      })),
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

  private normalizedText(value?: string | null): string | null {
    const next = value?.trim();
    return next ? next : null;
  }

  private lineKindIsDeduction(kind: PayrollLineKind): boolean {
    return kind === 'DEDUCTION' || kind === 'ADVANCE_RECOVERY';
  }

  private inferLineKindFromType(type: StaffCompensationType): PayrollLineKind {
    switch (type) {
      case 'SALARY':
        return 'BASIC_SALARY';
      case 'BONUS':
        return 'BONUS';
      case 'COMMISSION':
        return 'COMMISSION';
      case 'ADVANCE':
        return 'ADVANCE_RECOVERY';
      case 'DEDUCTION':
        return 'DEDUCTION';
      default:
        return 'ADJUSTMENT';
    }
  }

  private inferTypeFromLineKind(kind: PayrollLineKind): StaffCompensationType {
    switch (kind) {
      case 'BASIC_SALARY':
      case 'ALLOWANCE':
      case 'OVERTIME':
        return 'SALARY';
      case 'COMMISSION':
      case 'TIP_SHARE':
      case 'SERVICE_CHARGE_SHARE':
        return 'COMMISSION';
      case 'BONUS':
      case 'ADJUSTMENT':
        return 'BONUS';
      case 'ADVANCE_RECOVERY':
        return 'ADVANCE';
      case 'DEDUCTION':
        return 'DEDUCTION';
      default:
        return 'BONUS';
    }
  }

  private resolveLineKind(
    dto: Pick<CreateStaffCompensationDto, 'lineKind' | 'type'> | Pick<UpdateStaffCompensationDto, 'lineKind' | 'type'>,
    fallbackType: StaffCompensationType = 'SALARY',
  ): PayrollLineKind {
    if (dto.lineKind) {
      return dto.lineKind;
    }
    return this.inferLineKindFromType((dto.type ?? fallbackType) as StaffCompensationType);
  }

  private payrollBucketKey(kind: PayrollLineKind): keyof PayrollTotals {
    switch (kind) {
      case 'BASIC_SALARY':
        return 'baseSalaryCents';
      case 'ALLOWANCE':
        return 'allowanceCents';
      case 'COMMISSION':
        return 'commissionCents';
      case 'BONUS':
        return 'bonusCents';
      case 'TIP_SHARE':
        return 'tipShareCents';
      case 'OVERTIME':
        return 'overtimeCents';
      case 'SERVICE_CHARGE_SHARE':
        return 'serviceChargeCents';
      case 'ADJUSTMENT':
        return 'adjustmentCents';
      case 'ADVANCE_RECOVERY':
        return 'advanceRecoveryCents';
      case 'DEDUCTION':
        return 'otherDeductionCents';
      default:
        return 'adjustmentCents';
    }
  }

  private emptyPayrollTotals(): PayrollTotals {
    return {
      grossCents: 0,
      deductionCents: 0,
      netCents: 0,
      baseSalaryCents: 0,
      allowanceCents: 0,
      commissionCents: 0,
      bonusCents: 0,
      tipShareCents: 0,
      overtimeCents: 0,
      serviceChargeCents: 0,
      adjustmentCents: 0,
      advanceRecoveryCents: 0,
      otherDeductionCents: 0,
    };
  }

  private buildPayrollTotals(rows: CompensationLike[]): PayrollTotals {
    const totals = this.emptyPayrollTotals();
    for (const row of rows) {
      const kind = (row.lineKind ?? this.inferLineKindFromType(row.type as StaffCompensationType)) as PayrollLineKind;
      const amount = Math.max(0, row.amountCents);
      const bucket = this.payrollBucketKey(kind);
      totals[bucket] += amount;
      if (this.lineKindIsDeduction(kind)) {
        totals.deductionCents += amount;
      } else {
        totals.grossCents += amount;
      }
    }
    totals.netCents = Math.max(0, totals.grossCents - totals.deductionCents);
    return totals;
  }

  private async assertCompensationEditable(row: { id: string; status: string; lockedAt: Date | null }) {
    if (row.status === 'PAID') {
      throw new ConflictException('Paid compensation rows are locked. Record a payroll adjustment instead.');
    }
    if (row.lockedAt) {
      throw new ConflictException('This compensation row is already attached to a payslip and is locked.');
    }
  }

  private async assertSalaryPeriodUnique(
    staffId: string,
    args: {
      type: StaffCompensationType;
      lineKind: PayrollLineKind;
      periodLabel?: string | null;
      periodStart?: Date | null;
      periodEnd?: Date | null;
      excludeId?: string;
    },
  ) {
    if (args.type !== 'SALARY' && args.lineKind !== 'BASIC_SALARY') {
      return;
    }

    const periodLabel = this.normalizedText(args.periodLabel);
    const periodStart = args.periodStart ?? null;
    const periodEnd = args.periodEnd ?? null;
    if (!periodLabel && !(periodStart && periodEnd)) {
      throw new BadRequestException('Base salary rows require a period label or both periodStart and periodEnd');
    }

    const duplicate = await this.prisma.staffCompensation.findFirst({
      where: {
        staffId,
        status: { not: 'VOID' },
        id: args.excludeId ? { not: args.excludeId } : undefined,
        AND: [
          {
            OR: [
              { lineKind: 'BASIC_SALARY' },
              { type: 'SALARY' },
            ],
          },
          {
            OR: [
              ...(periodLabel ? [{ periodLabel }] : []),
              ...(periodStart && periodEnd
                ? [
                    {
                      periodStart,
                      periodEnd,
                    },
                  ]
                : []),
            ],
          },
        ],
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException('A base salary row already exists for this staff member in the same period');
    }
  }

  private async generateSlipNumber(tx: Prisma.TransactionClient, periodStart: Date): Promise<string> {
    const prefix = `${periodStart.getUTCFullYear()}${String(periodStart.getUTCMonth() + 1).padStart(2, '0')}`;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const candidate = `TPS-${prefix}-${randomBytes(3).toString('hex').toUpperCase()}`;
      const exists = await tx.payrollSlip.findFirst({
        where: { slipNumber: candidate },
        select: { id: true },
      });
      if (!exists) {
        return candidate;
      }
    }
    throw new ConflictException('Could not generate a unique payslip number');
  }

  private async actorStaffIds(actor: AuthUser): Promise<string[]> {
    const providerProfile = await this.prisma.providerProfile.findFirst({
      where: { userId: actor.userId, deletedAt: null },
      select: { id: true },
    });
    const rows = await this.prisma.staff.findMany({
      where: {
        deletedAt: null,
        OR: [
          { userId: actor.userId },
          ...(providerProfile ? [{ providerProfileId: providerProfile.id }] : []),
        ],
      },
      select: { id: true },
    });
    return rows.map((row) => row.id);
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

  private assertTenantWidePayrollAccess(actor: AuthUser, tenantId: string, branchId?: string | null) {
    if (branchId) {
      return;
    }
    if (userIsSuperAdmin(actor)) {
      return;
    }
    if (this.access.getOwnerTenantIds(actor).includes(tenantId)) {
      return;
    }
    throw new ForbiddenException('Branch managers must scope payroll operations to a branch');
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

    const recentTipsPromise = staffIds.length
      ? this.prisma.tip.findMany({
          where: { staffId: { in: staffIds } },
          orderBy: { createdAt: 'desc' },
          take: 16,
          include: {
            branch: { select: { id: true, name: true } },
            staff: { select: { id: true, displayName: true } },
          },
        })
      : Promise.resolve([]);

    const recentRatingsPromise = staffIds.length
      ? this.prisma.rating.findMany({
          where: { staffId: { in: staffIds }, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 16,
          include: {
            branch: { select: { id: true, name: true } },
            staff: { select: { id: true, displayName: true } },
          },
        })
      : Promise.resolve([]);

    const recentCompensationsPromise = staffIds.length
      ? this.prisma.staffCompensation.findMany({
          where: { staffId: { in: staffIds } },
          orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
          take: 16,
          include: {
            branch: { select: { id: true, name: true } },
            staff: { select: { id: true, displayName: true } },
          },
        })
      : Promise.resolve([]);

    const waiterCallsPromise = staffIds.length
      ? this.prisma.waiterCallRequest.findMany({
          where: {
            staffId: { in: staffIds },
            status: { in: ['PENDING', 'ACKNOWLEDGED'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 24,
          include: {
            tenant: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
            table: { select: { code: true, label: true } },
          },
        })
      : Promise.resolve([]);

    const assistancePromise = staffIds.length
      ? this.prisma.assistanceRequest.findMany({
          where: {
            staffId: { in: staffIds },
            status: { in: ['PENDING', 'ACKNOWLEDGED'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 24,
          include: {
            tenant: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
            station: { select: { code: true, label: true } },
          },
        })
      : Promise.resolve([]);

    const diningOrdersPromise = staffIds.length
      ? this.prisma.diningOrder.findMany({
          where: {
            deletedAt: null,
            status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'] },
            OR: [
              { staffId: { in: staffIds } },
              { claimedByStaffId: { in: staffIds } },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 24,
          include: {
            tenant: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
            diningTable: { select: { code: true, label: true } },
          },
        })
      : Promise.resolve([]);

    const beautyBookingsPromise = staffIds.length
      ? this.prisma.beautyBooking.findMany({
          where: {
            deletedAt: null,
            status: { in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'IN_SERVICE'] },
            OR: [
              { staffId: { in: staffIds } },
              {
                services: {
                  some: {
                    staffId: { in: staffIds },
                    status: { in: ['PENDING', 'IN_PROGRESS'] },
                  },
                },
              },
            ],
          },
          orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
          take: 24,
          include: {
            tenant: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
            station: { select: { code: true, label: true } },
            services: {
              where: {
                OR: [
                  { staffId: { in: staffIds } },
                  { staffId: null },
                ],
              },
              select: {
                id: true,
                status: true,
                beautyService: {
                  select: { name: true },
                },
              },
            },
          },
        })
      : Promise.resolve([]);

    const linksPromise = Promise.all(
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
      );

    const [
      recentTips,
      recentRatings,
      recentCompensations,
      assignedWaiterCalls,
      assignedAssistance,
      assignedDiningOrders,
      assignedBeautyBookings,
      links,
    ] = await Promise.all([
      recentTipsPromise,
      recentRatingsPromise,
      recentCompensationsPromise,
      waiterCallsPromise,
      assistancePromise,
      diningOrdersPromise,
      beautyBookingsPromise,
      linksPromise,
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
              payoutProfile:
                (providerProfile as Record<string, unknown>).payoutProfile &&
                typeof (providerProfile as Record<string, unknown>).payoutProfile === 'object' &&
                !Array.isArray((providerProfile as Record<string, unknown>).payoutProfile)
                  ? {
                      method:
                        typeof ((providerProfile as Record<string, unknown>).payoutProfile as Record<string, unknown>).method === 'string'
                          ? (((providerProfile as Record<string, unknown>).payoutProfile as Record<string, unknown>).method as string)
                          : null,
                      recipientLabel:
                        typeof ((providerProfile as Record<string, unknown>).payoutProfile as Record<string, unknown>).recipientLabel === 'string'
                          ? (((providerProfile as Record<string, unknown>).payoutProfile as Record<string, unknown>).recipientLabel as string)
                          : null,
                      accountMask:
                        typeof ((providerProfile as Record<string, unknown>).payoutProfile as Record<string, unknown>).accountMask === 'string'
                          ? (((providerProfile as Record<string, unknown>).payoutProfile as Record<string, unknown>).accountMask as string)
                          : null,
                      note:
                        typeof ((providerProfile as Record<string, unknown>).payoutProfile as Record<string, unknown>).note === 'string'
                          ? (((providerProfile as Record<string, unknown>).payoutProfile as Record<string, unknown>).note as string)
                          : null,
                    }
                  : null,
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
      desk: {
        openRequestCount: assignedWaiterCalls.length + assignedAssistance.length,
        activeTaskCount: assignedDiningOrders.length + assignedBeautyBookings.length,
        requestQueue: [
          ...assignedWaiterCalls.map((row) => ({
            id: row.id,
            kind: 'WAITER_CALL',
            vertical: 'FOOD_DINING',
            tenantId: row.tenantId,
            tenantName: row.tenant.name,
            branchId: row.branchId,
            branchName: row.branch.name,
            status: row.status,
            locationLabel: row.table ? `${row.table.code}${row.table.label ? ` · ${row.table.label}` : ''}` : null,
            notes: row.notes,
            createdAt: row.createdAt,
          })),
          ...assignedAssistance.map((row) => ({
            id: row.id,
            kind: 'ASSISTANCE_REQUEST',
            vertical: 'BEAUTY_GROOMING',
            tenantId: row.tenantId,
            tenantName: row.tenant.name,
            branchId: row.branchId,
            branchName: row.branch.name,
            status: row.status,
            locationLabel: row.station ? `${row.station.code}${row.station.label ? ` · ${row.station.label}` : ''}` : null,
            notes: row.notes,
            createdAt: row.createdAt,
          })),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        taskQueue: [
          ...assignedDiningOrders.map((row) => ({
            id: row.id,
            kind: 'DINING_ORDER',
            vertical: 'FOOD_DINING',
            tenantId: row.tenantId,
            tenantName: row.tenant.name,
            branchId: row.branchId,
            branchName: row.branch.name,
            status: row.status,
            reference: row.orderNumber,
            customerLabel: row.customerPhone,
            locationLabel: row.diningTable ? `${row.diningTable.code}${row.diningTable.label ? ` · ${row.diningTable.label}` : ''}` : null,
            amountCents: row.totalCents,
            currency: row.currency,
            scheduledAt: null,
            serviceSummary: null,
            createdAt: row.createdAt,
          })),
          ...assignedBeautyBookings.map((row) => ({
            id: row.id,
            kind: 'BEAUTY_BOOKING',
            vertical: 'BEAUTY_GROOMING',
            tenantId: row.tenantId,
            tenantName: row.tenant.name,
            branchId: row.branchId,
            branchName: row.branch.name,
            status: row.status,
            reference: row.bookingNumber,
            customerLabel: row.customerName ?? row.customerPhone ?? null,
            locationLabel: row.station ? `${row.station.code}${row.station.label ? ` · ${row.station.label}` : ''}` : null,
            amountCents: row.totalCents,
            currency: row.currency,
            scheduledAt: row.scheduledAt,
            serviceSummary: row.services.map((service) => service.beautyService.name).slice(0, 3),
            createdAt: row.createdAt,
          })),
        ].sort((a, b) => {
          const aTime = new Date(a.scheduledAt ?? a.createdAt).getTime();
          const bTime = new Date(b.scheduledAt ?? b.createdAt).getTime();
          return aTime - bTime;
        }),
      },
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
        include: {
          providerProfile: { select: { registryCode: true } },
        },
      });
      return rows.map((r) => this.mapStaff(r));
    }
    if (this.access.getOwnerTenantIds(actor).includes(tenantId)) {
      const rows = await this.prisma.staff.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          providerProfile: { select: { registryCode: true } },
        },
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
      include: {
        providerProfile: { select: { registryCode: true } },
      },
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
      include: {
        providerProfile: { select: { registryCode: true } },
      },
    });
    return rows.map((r) => this.mapStaff(r));
  }

  async findOne(actor: AuthUser, id: string) {
    await this.assertCanManageExistingStaff(actor, id);
    const s = await this.prisma.staff.findFirst({
      where: { id, deletedAt: null },
      include: {
        providerProfile: { select: { registryCode: true } },
      },
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

  async listCompensationFeed(actor: AuthUser, tenantId: string, branchId?: string) {
    if (!tenantId?.trim()) {
      throw new BadRequestException('tenantId query is required');
    }
    await this.access.assertReadableTenant(actor, tenantId);
    await this.assertCanManageStaff(actor, tenantId, { branchId: branchId?.trim() || undefined });

    const rows = await this.prisma.staffCompensation.findMany({
      where: {
        tenantId,
        ...(branchId?.trim() ? { branchId: branchId.trim() } : {}),
      },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
      take: 240,
      include: {
        staff: {
          select: {
            id: true,
            displayName: true,
            roleInTenant: true,
            status: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      ...this.mapCompensation(row),
      staffName: row.staff.displayName,
      roleInTenant: row.staff.roleInTenant,
      staffStatus: row.staff.status,
      branchName: row.branch?.name ?? null,
      branchCode: row.branch?.code ?? null,
    }));
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

    const lineKind = this.resolveLineKind(dto, dto.type ?? 'SALARY');
    const type = (dto.type ?? this.inferTypeFromLineKind(lineKind)) as StaffCompensationType;
    const status = (dto.status ?? 'SCHEDULED') as StaffCompensationStatus;
    if (status === 'PAID') {
      throw new BadRequestException('Use payroll disbursement to mark compensation as paid');
    }
    if (status === 'VOID') {
      throw new BadRequestException('Create the row first, then void it if needed');
    }
    const effectiveDate = this.asDate(dto.effectiveDate) ?? new Date();
    const periodStart = this.asDate(dto.periodStart) ?? null;
    const periodEnd = this.asDate(dto.periodEnd) ?? null;
    const periodLabel = this.normalizedText(dto.periodLabel);

    await this.assertSalaryPeriodUnique(staffId, {
      type,
      lineKind,
      periodLabel,
      periodStart,
      periodEnd,
    });

    const row = await this.prisma.staffCompensation.create({
      data: {
        tenantId,
        branchId,
        staffId,
        type,
        status,
        lineKind,
        label: this.normalizedText(dto.label),
        sourceReference: this.normalizedText(dto.sourceReference),
        amountCents: Math.max(0, Math.floor(dto.amountCents)),
        currency: this.normalizedCurrency(dto.currency),
        periodLabel,
        periodStart,
        periodEnd,
        effectiveDate,
        paidAt: null,
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
        lineKind: row.lineKind,
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
    await this.assertCompensationEditable(existing);

    const branchId = dto.branchId === undefined ? existing.branchId : dto.branchId?.trim() || null;
    if (branchId) {
      await this.access.assertBranchBelongsToTenant(branchId, tenantId);
      await this.assertCanManageStaff(actor, tenantId, { branchId });
    }

    const lineKind = this.resolveLineKind(dto, existing.type as StaffCompensationType);
    const nextType = (dto.type ?? this.inferTypeFromLineKind(lineKind)) as StaffCompensationType;
    const nextStatus = (dto.status ?? existing.status) as StaffCompensationStatus;
    if (nextStatus === 'PAID') {
      throw new BadRequestException('Use payroll disbursement to mark compensation as paid');
    }
    const nextEffectiveDate = this.asDate(dto.effectiveDate) ?? undefined;
    const nextPeriodStart = dto.periodStart === undefined ? existing.periodStart : this.asDate(dto.periodStart);
    const nextPeriodEnd = dto.periodEnd === undefined ? existing.periodEnd : this.asDate(dto.periodEnd);
    const nextPeriodLabel =
      dto.periodLabel === undefined ? existing.periodLabel : this.normalizedText(dto.periodLabel);

    await this.assertSalaryPeriodUnique(staffId, {
      type: nextType,
      lineKind,
      periodLabel: nextPeriodLabel,
      periodStart: nextPeriodStart,
      periodEnd: nextPeriodEnd,
      excludeId: compensationId,
    });

    const updated = await this.prisma.staffCompensation.update({
      where: { id: compensationId },
      data: {
        branchId,
        type: nextType === existing.type ? undefined : nextType,
        status: nextStatus === existing.status ? undefined : nextStatus,
        lineKind: lineKind === existing.lineKind ? undefined : lineKind,
        label: dto.label === undefined ? undefined : this.normalizedText(dto.label),
        sourceReference:
          dto.sourceReference === undefined ? undefined : this.normalizedText(dto.sourceReference),
        amountCents: dto.amountCents == null ? undefined : Math.max(0, Math.floor(dto.amountCents)),
        currency: dto.currency === undefined ? undefined : this.normalizedCurrency(dto.currency),
        periodLabel: dto.periodLabel === undefined ? undefined : nextPeriodLabel,
        periodStart: dto.periodStart === undefined ? undefined : nextPeriodStart,
        periodEnd: dto.periodEnd === undefined ? undefined : nextPeriodEnd,
        effectiveDate: nextEffectiveDate,
        paidAt: undefined,
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

  async listPayrollRuns(actor: AuthUser, tenantId: string, branchId?: string) {
    if (!tenantId?.trim()) {
      throw new BadRequestException('tenantId query is required');
    }
    this.assertTenantWidePayrollAccess(actor, tenantId, branchId);
    await this.access.assertReadableTenant(actor, tenantId);
    await this.assertCanManageStaff(actor, tenantId, { branchId: branchId?.trim() || undefined });

    const rows = await this.prisma.payrollRun.findMany({
      where: {
        tenantId,
        ...(branchId?.trim() ? { branchId: branchId.trim() } : {}),
      },
      orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }],
      take: 48,
      include: {
        slips: {
          select: {
            id: true,
            staffId: true,
            status: true,
            grossCents: true,
            deductionCents: true,
            netCents: true,
          },
        },
      },
    });

    return rows.map((row) => this.mapPayrollRun(row));
  }

  async createPayrollRun(actor: AuthUser, dto: CreatePayrollRunDto, meta: StaffRequestMeta) {
    await this.access.assertWritableTenant(actor, dto.tenantId);
    await this.assertCanManageStaff(actor, dto.tenantId, { branchId: dto.branchId ?? undefined });

    const tenantId = dto.tenantId.trim();
    const branchId = dto.branchId?.trim() || null;
    this.assertTenantWidePayrollAccess(actor, tenantId, branchId);
    if (branchId) {
      await this.access.assertBranchBelongsToTenant(branchId, tenantId);
    }

    const periodLabel = this.normalizedText(dto.periodLabel);
    if (!periodLabel) {
      throw new BadRequestException('periodLabel is required');
    }
    const periodStart = this.asDate(dto.periodStart);
    const periodEnd = this.asDate(dto.periodEnd);
    if (!periodStart || !periodEnd) {
      throw new BadRequestException('periodStart and periodEnd are required');
    }
    if (periodStart.getTime() > periodEnd.getTime()) {
      throw new BadRequestException('periodStart must be before periodEnd');
    }

    const existingRun = await this.prisma.payrollRun.findFirst({
      where: {
        tenantId,
        branchId,
        periodLabel,
        periodStart,
        periodEnd,
        status: { in: ['SUBMITTED', 'APPROVED', 'PAID', 'RECONCILED'] },
      },
      select: { id: true },
    });
    if (existingRun) {
      throw new ConflictException('A payroll run already exists for this scope and period');
    }

    const eligibleRows = await this.prisma.staffCompensation.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        payrollSlipId: null,
        payrollRunId: null,
        lockedAt: null,
        status: { in: ['SCHEDULED', 'APPROVED'] },
        OR: [
          { periodLabel },
          {
            AND: [
              { periodStart: { not: null, lte: periodEnd } },
              { periodEnd: { not: null, gte: periodStart } },
            ],
          },
          {
            AND: [
              { periodStart: null },
              { periodEnd: null },
              { effectiveDate: { gte: periodStart, lte: periodEnd } },
            ],
          },
        ],
      },
      orderBy: [{ staffId: 'asc' }, { effectiveDate: 'asc' }, { createdAt: 'asc' }],
    });

    if (!eligibleRows.length) {
      throw new ConflictException('No eligible compensation rows found for this payroll run');
    }

    const currencies = new Set(eligibleRows.map((row) => row.currency));
    const currency = this.normalizedCurrency(dto.currency ?? Array.from(currencies)[0] ?? 'TZS');
    if (currencies.size > 1 || Array.from(currencies).some((value) => value !== currency)) {
      throw new ConflictException('All compensation rows in a payroll run must share the same currency');
    }

    const rowsByStaff = new Map<string, typeof eligibleRows>();
    for (const row of eligibleRows) {
      const list = rowsByStaff.get(row.staffId) ?? [];
      list.push(row);
      rowsByStaff.set(row.staffId, list);
    }

    const createdRun = await this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.create({
        data: {
          tenantId,
          branchId,
          status: 'SUBMITTED',
          currency,
          periodLabel,
          periodStart,
          periodEnd,
          notes: this.normalizedText(dto.notes),
          createdByUserId: actor.userId,
        },
      });

      for (const [staffRowId, rows] of rowsByStaff.entries()) {
        const totals = this.buildPayrollTotals(rows as CompensationLike[]);
        const branchIds = new Set(rows.map((row) => row.branchId).filter((value): value is string => Boolean(value)));
        const slipBranchId = branchIds.size === 1 ? Array.from(branchIds)[0] : branchId;
        const slipNumber = await this.generateSlipNumber(tx, periodStart);
        const slip = await tx.payrollSlip.create({
          data: {
            tenantId,
            branchId: slipBranchId,
            staffId: staffRowId,
            payrollRunId: run.id,
            slipNumber,
            status: 'SUBMITTED',
            currency,
            periodLabel,
            periodStart,
            periodEnd,
            effectiveDate: periodEnd,
            ...totals,
            notes: this.normalizedText(dto.notes),
            createdByUserId: actor.userId,
          },
        });

        await tx.staffCompensation.updateMany({
          where: { id: { in: rows.map((row) => row.id) } },
          data: {
            payrollRunId: run.id,
            payrollSlipId: slip.id,
            lockedAt: new Date(),
          },
        });
      }

      return run;
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'PayrollRun',
      entityId: createdRun.id,
      tenantId,
      branchId: createdRun.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: `Payroll run created for ${periodLabel}`,
      details: {
        periodLabel,
        periodStart,
        periodEnd,
        currency,
        rows: eligibleRows.length,
        staffCount: rowsByStaff.size,
      } as Prisma.InputJsonValue,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.getPayrollRun(actor, createdRun.id);
  }

  async getPayrollRun(actor: AuthUser, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        slips: {
          orderBy: [{ netCents: 'desc' }, { createdAt: 'asc' }],
          include: {
            staff: {
              select: {
                id: true,
                displayName: true,
                email: true,
                phone: true,
                providerProfile: true,
              },
            },
            branch: { select: { id: true, name: true, code: true } },
            compensationRows: {
              orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }],
            },
            disbursements: {
              orderBy: [{ recordedAt: 'desc' }, { createdAt: 'desc' }],
            },
          },
        },
      },
    });
    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    await this.access.assertReadableTenant(actor, run.tenantId);
    this.assertTenantWidePayrollAccess(actor, run.tenantId, run.branchId);
    await this.assertCanManageStaff(actor, run.tenantId, { branchId: run.branchId ?? undefined });

    return {
      ...this.mapPayrollRun(run),
      branch: run.branch,
      slips: run.slips.map((slip) =>
        this.mapPayrollSlip({
          ...slip,
          tenant: null,
          payrollRun: { id: run.id, status: run.status },
        }),
      ),
    };
  }

  async updatePayrollRunStatus(
    actor: AuthUser,
    runId: string,
    dto: UpdatePayrollRunStatusDto,
    meta: StaffRequestMeta,
  ) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId },
      include: {
        slips: {
          include: {
            disbursements: {
              where: { status: 'RECORDED' },
              select: { id: true, amountCents: true },
            },
          },
        },
      },
    });
    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    await this.access.assertWritableTenant(actor, run.tenantId);
    this.assertTenantWidePayrollAccess(actor, run.tenantId, run.branchId);
    await this.assertCanManageStaff(actor, run.tenantId, { branchId: run.branchId ?? undefined });

    const target = dto.status;
    if (target === run.status) {
      return this.getPayrollRun(actor, runId);
    }

    if (target === 'APPROVED') {
      if (!['SUBMITTED', 'DRAFT'].includes(run.status)) {
        throw new ConflictException('Only submitted payroll runs can be approved');
      }
      await this.prisma.$transaction([
        this.prisma.payrollRun.update({
          where: { id: runId },
          data: {
            status: 'APPROVED',
            approvedAt: new Date(),
            approvedByUserId: actor.userId,
          },
        }),
        this.prisma.payrollSlip.updateMany({
          where: { payrollRunId: runId, status: { in: ['SUBMITTED', 'DRAFT'] } },
          data: {
            status: 'APPROVED',
            approvedAt: new Date(),
            approvedByUserId: actor.userId,
          },
        }),
        this.prisma.staffCompensation.updateMany({
          where: { payrollRunId: runId, status: 'SCHEDULED' },
          data: { status: 'APPROVED' },
        }),
      ]);
    } else if (target === 'RECONCILED') {
      if (run.slips.some((slip) => !['PAID', 'RECONCILED'].includes(slip.status))) {
        throw new ConflictException('All slips must be paid before a payroll run can be reconciled');
      }
      await this.prisma.$transaction([
        this.prisma.payrollRun.update({
          where: { id: runId },
          data: {
            status: 'RECONCILED',
            reconciledAt: new Date(),
          },
        }),
        this.prisma.payrollSlip.updateMany({
          where: { payrollRunId: runId, status: 'PAID' },
          data: { status: 'RECONCILED' },
        }),
      ]);
    } else if (target === 'VOID') {
      if (
        run.slips.some(
          (slip) =>
            ['PAID', 'RECONCILED'].includes(slip.status) || slip.disbursements.length > 0,
        )
      ) {
        throw new ConflictException('Paid payroll runs cannot be voided');
      }
      await this.prisma.$transaction([
        this.prisma.payrollRun.update({
          where: { id: runId },
          data: {
            status: 'VOID',
            voidedAt: new Date(),
          },
        }),
        this.prisma.payrollSlip.updateMany({
          where: { payrollRunId: runId },
          data: { status: 'VOID' },
        }),
        this.prisma.staffCompensation.updateMany({
          where: { payrollRunId: runId },
          data: {
            payrollRunId: null,
            payrollSlipId: null,
            lockedAt: null,
          },
        }),
      ]);
    } else {
      throw new BadRequestException('Unsupported payroll run status transition');
    }

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'PayrollRun',
      entityId: runId,
      tenantId: run.tenantId,
      branchId: run.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: `Payroll run moved to ${target}`,
      details: { status: target } as Prisma.InputJsonValue,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.getPayrollRun(actor, runId);
  }

  async listStaffPayslips(actor: AuthUser, staffId: string) {
    await this.assertCanManageExistingStaff(actor, staffId);
    const rows = await this.prisma.payrollSlip.findMany({
      where: { staffId },
      orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }],
      include: {
        branch: { select: { id: true, name: true, code: true } },
        disbursements: { orderBy: [{ recordedAt: 'desc' }], take: 8 },
        compensationRows: { orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }] },
      },
      take: 60,
    });
    return rows.map((row) => this.mapPayrollSlip(row));
  }

  async getPayrollSlip(actor: AuthUser, slipId: string) {
    const slip = await this.prisma.payrollSlip.findFirst({
      where: { id: slipId },
      include: {
        tenant: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, code: true } },
        staff: {
          select: {
            id: true,
            displayName: true,
            email: true,
            phone: true,
            providerProfile: true,
          },
        },
        payrollRun: { select: { id: true, status: true } },
        compensationRows: { orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }] },
        disbursements: { orderBy: [{ recordedAt: 'desc' }, { createdAt: 'desc' }] },
      },
    });
    if (!slip) {
      throw new NotFoundException('Payslip not found');
    }
    await this.access.assertReadableTenant(actor, slip.tenantId);
    this.assertTenantWidePayrollAccess(actor, slip.tenantId, slip.branchId);
    await this.assertCanManageStaff(actor, slip.tenantId, { branchId: slip.branchId ?? undefined });
    return this.mapPayrollSlip(slip);
  }

  async recordPayrollDisbursement(
    actor: AuthUser,
    slipId: string,
    dto: RecordPayrollDisbursementDto,
    meta: StaffRequestMeta,
  ) {
    const slip = await this.prisma.payrollSlip.findFirst({
      where: { id: slipId },
      include: {
        disbursements: {
          where: { status: 'RECORDED' },
          orderBy: [{ recordedAt: 'desc' }, { createdAt: 'desc' }],
        },
        compensationRows: true,
        payrollRun: {
          include: {
            slips: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        },
        staff: { select: { id: true, displayName: true } },
      },
    });
    if (!slip) {
      throw new NotFoundException('Payslip not found');
    }

    await this.access.assertWritableTenant(actor, slip.tenantId);
    this.assertTenantWidePayrollAccess(actor, slip.tenantId, slip.branchId);
    await this.assertCanManageStaff(actor, slip.tenantId, { branchId: slip.branchId ?? undefined });
    if (!['APPROVED', 'PAID'].includes(slip.status)) {
      throw new ConflictException('Only approved payroll slips can receive disbursements');
    }

    const recordedTotal = slip.disbursements.reduce((sum, row) => sum + row.amountCents, 0);
    const remaining = Math.max(0, slip.netCents - recordedTotal);
    if (remaining <= 0) {
      throw new ConflictException('This payslip is already fully disbursed');
    }

    const amountCents = dto.amountCents == null ? remaining : Math.max(0, Math.floor(dto.amountCents));
    if (amountCents <= 0) {
      throw new BadRequestException('Disbursement amount must be greater than zero');
    }
    if (amountCents > remaining) {
      throw new ConflictException('Disbursement amount exceeds the remaining net pay');
    }

    const recordedAt = this.asDate(dto.recordedAt) ?? new Date();
    const disbursement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payrollDisbursement.create({
        data: {
          payrollSlipId: slip.id,
          method: dto.method as PayrollDisbursementMethod,
          status: dto.status ?? 'RECORDED',
          amountCents,
          reference: this.normalizedText(dto.reference),
          accountMask: this.normalizedText(dto.accountMask),
          recipientLabel: this.normalizedText(dto.recipientLabel),
          proofNote: this.normalizedText(dto.proofNote),
          externalTransactionId: this.normalizedText(dto.externalTransactionId),
          recordedByUserId: actor.userId,
          recordedAt,
        },
      });

      const nextRecorded = recordedTotal + (created.status === 'RECORDED' ? amountCents : 0);
      if (created.status === 'RECORDED' && nextRecorded >= slip.netCents) {
        await tx.payrollSlip.update({
          where: { id: slip.id },
          data: {
            status: 'PAID',
            paidAt: recordedAt,
          },
        });
        await tx.staffCompensation.updateMany({
          where: { payrollSlipId: slip.id },
          data: {
            status: 'PAID',
            paidAt: recordedAt,
          },
        });
      }

      if (slip.payrollRunId) {
        const statuses = slip.payrollRun?.slips.map((row) => (row.id === slip.id && nextRecorded >= slip.netCents ? 'PAID' : row.status)) ?? [];
        if (statuses.length && statuses.every((status) => status === 'PAID' || status === 'RECONCILED')) {
          await tx.payrollRun.update({
            where: { id: slip.payrollRunId },
            data: {
              status: 'PAID',
              paidAt: recordedAt,
            },
          });
        }
      }

      return created;
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'PayrollDisbursement',
      entityId: disbursement.id,
      tenantId: slip.tenantId,
      branchId: slip.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: `Payroll disbursement recorded for ${slip.staff.displayName}`,
      details: {
        slipId,
        method: disbursement.method,
        amountCents: disbursement.amountCents,
        reference: disbursement.reference,
      } as Prisma.InputJsonValue,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.getPayrollSlip(actor, slipId);
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
    const ids = await this.actorStaffIds(actor);
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
        notes: row.notes,
        payrollRunId: row.payrollRunId,
        payrollSlipId: row.payrollSlipId,
        lockedAt: row.lockedAt,
        createdAt: row.createdAt,
        tenantName: row.tenant.name,
        branchName: row.branch?.name ?? null,
        staffName: row.staff.displayName,
      })),
    };
  }

  async listMyPayslips(actor: AuthUser) {
    const ids = await this.actorStaffIds(actor);
    if (!ids.length) {
      return { items: [], total: 0 };
    }
    const rows = await this.prisma.payrollSlip.findMany({
      where: { staffId: { in: ids } },
      orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }],
      take: 120,
      include: {
        tenant: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, code: true } },
        staff: {
          select: {
            id: true,
            displayName: true,
            email: true,
            phone: true,
            providerProfile: true,
          },
        },
        payrollRun: { select: { id: true, status: true } },
        compensationRows: { orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }] },
        disbursements: { orderBy: [{ recordedAt: 'desc' }, { createdAt: 'desc' }] },
      },
    });
    return {
      total: rows.length,
      items: rows.map((row) => this.mapPayrollSlip(row)),
    };
  }

  async getMyPayslip(actor: AuthUser, slipId: string) {
    const ids = await this.actorStaffIds(actor);
    if (!ids.length) {
      throw new NotFoundException('Payslip not found');
    }
    const row = await this.prisma.payrollSlip.findFirst({
      where: {
        id: slipId,
        staffId: { in: ids },
      },
      include: {
        tenant: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, code: true } },
        staff: {
          select: {
            id: true,
            displayName: true,
            email: true,
            phone: true,
            providerProfile: true,
          },
        },
        payrollRun: { select: { id: true, status: true } },
        compensationRows: { orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }] },
        disbursements: { orderBy: [{ recordedAt: 'desc' }, { createdAt: 'desc' }] },
      },
    });
    if (!row) {
      throw new NotFoundException('Payslip not found');
    }
    return this.mapPayrollSlip(row);
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
