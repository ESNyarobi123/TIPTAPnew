import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit-logs/audit.service';
import type { AuthUser } from '../auth/types/request-user.type';
import { userHasRole, userIsSuperAdmin } from '../auth/types/request-user.type';
import type { CreateProviderProfileDto } from './dto/create-provider-profile.dto';
import type { UpdateProviderProfileDto } from './dto/update-provider-profile.dto';
import type { UpsertMyProviderProfileDto } from './dto/upsert-my-provider-profile.dto';

export type ProviderRequestMeta = {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

type ProviderRow = {
  id: string;
  userId: string | null;
  displayName: string;
  headline: string | null;
  bio: string | null;
  verifiedSummary: string | null;
  publicSlug: string | null;
  registryCode: string | null;
  publicRatingAvg: Prisma.Decimal | null;
  publicRatingCount: number;
  skills: Prisma.JsonValue | null;
  internalNotes: string | null;
  payoutProfile?: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

type ProviderPayoutProfile = {
  method: string | null;
  recipientLabel: string | null;
  accountMask: string | null;
  note: string | null;
};

@Injectable()
export class ProviderRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private assertCanManageProfiles(actor: AuthUser): void {
    const ok =
      userIsSuperAdmin(actor) ||
      actor.roleAssignments.some((a) => a.role === 'TENANT_OWNER');
    if (!ok) {
      throw new ForbiddenException('Cannot manage provider registry');
    }
  }

  private assertCanLookupProfiles(actor: AuthUser): void {
    if (
      userIsSuperAdmin(actor) ||
      userHasRole(actor, 'TENANT_OWNER', 'BRANCH_MANAGER')
    ) {
      return;
    }
    throw new ForbiddenException('Cannot look up provider profiles');
  }

  private async assertCanReadInternal(actor: AuthUser, profileId: string): Promise<void> {
    if (userIsSuperAdmin(actor)) {
      return;
    }
    const ownerTenants = actor.roleAssignments
      .filter((a) => a.role === 'TENANT_OWNER' && a.tenantId)
      .map((a) => a.tenantId as string);
    if (ownerTenants.length === 0) {
      throw new ForbiddenException('Cannot access this profile');
    }
    const hit = await this.prisma.staff.findFirst({
      where: {
        providerProfileId: profileId,
        tenantId: { in: ownerTenants },
        deletedAt: null,
      },
    });
    if (!hit) {
      throw new ForbiddenException('Cannot access this profile');
    }
  }

  private normalizeSlug(raw: string | null | undefined): string | undefined {
    const v = raw?.trim().toLowerCase();
    if (!v) {
      return undefined;
    }
    const normalized = v
      .replace(/[^a-z0-9\-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '');
    return normalized || undefined;
  }

  private normalizeSkills(skills: string[] | undefined): string[] {
    const out = (skills ?? [])
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 24);
    return [...new Set(out)];
  }

  private normalizeOptionalText(raw: string | null | undefined): string | null {
    const value = raw?.trim();
    return value ? value : null;
  }

  private parsePayoutProfile(value: Prisma.JsonValue | null | undefined): ProviderPayoutProfile | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const row = value as Record<string, unknown>;
    const method = typeof row.method === 'string' && row.method.trim() ? row.method.trim() : null;
    const recipientLabel =
      typeof row.recipientLabel === 'string' && row.recipientLabel.trim() ? row.recipientLabel.trim() : null;
    const accountMask =
      typeof row.accountMask === 'string' && row.accountMask.trim() ? row.accountMask.trim() : null;
    const note = typeof row.note === 'string' && row.note.trim() ? row.note.trim() : null;
    if (!method && !recipientLabel && !accountMask && !note) {
      return null;
    }
    return { method, recipientLabel, accountMask, note };
  }

  private normalizePayoutProfile(input: {
    payoutMethod?: string | null;
    payoutRecipientLabel?: string | null;
    payoutAccountMask?: string | null;
    payoutNote?: string | null;
  }): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
    const anyProvided =
      input.payoutMethod !== undefined ||
      input.payoutRecipientLabel !== undefined ||
      input.payoutAccountMask !== undefined ||
      input.payoutNote !== undefined;
    if (!anyProvided) {
      return undefined;
    }
    const method = this.normalizeOptionalText(input.payoutMethod);
    const recipientLabel = this.normalizeOptionalText(input.payoutRecipientLabel);
    const accountMask = this.normalizeOptionalText(input.payoutAccountMask);
    const note = this.normalizeOptionalText(input.payoutNote);
    if (!method && !recipientLabel && !accountMask && !note) {
      return Prisma.JsonNull;
    }
    return {
      method,
      recipientLabel,
      accountMask,
      note,
    } satisfies Prisma.InputJsonObject;
  }

  private async ensureSlugAvailable(slug: string | undefined, exceptId?: string): Promise<void> {
    if (!slug) {
      return;
    }
    const taken = await this.prisma.providerProfile.findFirst({
      where: {
        publicSlug: slug,
        deletedAt: null,
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
    });
    if (taken) {
      throw new ConflictException('publicSlug already in use');
    }
  }

  private randomRegistryCode(): string {
    return `TIP-P${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  private async ensureRegistryCode(): Promise<string> {
    for (let i = 0; i < 16; i += 1) {
      const code = this.randomRegistryCode();
      const taken = await this.prisma.providerProfile.findFirst({
        where: { registryCode: code, deletedAt: null },
        select: { id: true },
      });
      if (!taken) {
        return code;
      }
    }
    throw new ConflictException('Could not allocate provider code');
  }

  private async withRegistryCode(profile: ProviderRow): Promise<ProviderRow> {
    if (profile.registryCode) {
      return profile;
    }
    const updated = await this.prisma.providerProfile.update({
      where: { id: profile.id },
      data: { registryCode: await this.ensureRegistryCode() },
    });
    return updated as unknown as ProviderRow;
  }

  private mapPublic(p: ProviderRow) {
    const skills =
      Array.isArray(p.skills) && p.skills.every((x) => typeof x === 'string')
        ? (p.skills as string[])
        : [];
    return {
      id: p.id,
      registryCode: p.registryCode,
      displayName: p.displayName,
      headline: p.headline,
      bio: p.bio,
      verifiedSummary: p.verifiedSummary,
      publicRatingAvg: p.publicRatingAvg != null ? Number(p.publicRatingAvg) : null,
      publicRatingCount: p.publicRatingCount,
      skills,
    };
  }

  private mapInternal(p: ProviderRow) {
    return {
      ...this.mapPublic(p),
      publicSlug: p.publicSlug,
      internalNotes: p.internalNotes,
      payoutProfile: this.parsePayoutProfile(p.payoutProfile),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  private mapLookup(p: ProviderRow) {
    return {
      id: p.id,
      userId: p.userId,
      registryCode: p.registryCode,
      publicSlug: p.publicSlug,
      displayName: p.displayName,
      headline: p.headline,
      verifiedSummary: p.verifiedSummary,
      publicRatingAvg: p.publicRatingAvg != null ? Number(p.publicRatingAvg) : null,
      publicRatingCount: p.publicRatingCount,
      skills:
        Array.isArray(p.skills) && p.skills.every((x) => typeof x === 'string')
          ? (p.skills as string[])
          : [],
    };
  }

  private async buildEmploymentHistory(profileId: string) {
    const staffRows = await this.prisma.staff.findMany({
      where: {
        providerProfileId: profileId,
      },
      orderBy: { updatedAt: 'desc' },
      take: 8,
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
          select: {
            id: true,
            name: true,
          },
        },
        assignments: {
          orderBy: { startedAt: 'desc' },
          take: 6,
          include: {
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        ratings: {
          where: { deletedAt: null },
          select: { score: true },
        },
      },
    });

    const totalRatings = staffRows.reduce((sum, row) => sum + row.ratings.length, 0);
    const weightedRating = staffRows.reduce(
      (sum, row) => sum + row.ratings.reduce((acc, rating) => acc + rating.score, 0),
      0,
    );

    return {
      employmentSummary: {
        linkedBusinesses: new Set(staffRows.map((row) => row.tenantId)).size,
        activeAssignments: staffRows.reduce(
          (sum, row) =>
            sum + row.assignments.filter((assignment) => assignment.status === 'ACTIVE' && !assignment.endedAt).length,
          0,
        ),
        completedAssignments: staffRows.reduce(
          (sum, row) =>
            sum + row.assignments.filter((assignment) => assignment.status === 'ENDED' || assignment.endedAt).length,
          0,
        ),
        averageRating: totalRatings > 0 ? weightedRating / totalRatings : null,
        totalRatings,
      },
      employmentHistory: staffRows.map((row) => ({
        staffId: row.id,
        tenantId: row.tenantId,
        tenantName: row.tenant.name,
        branchId: row.branchId,
        branchName: row.branch?.name ?? null,
        roleInTenant: row.roleInTenant,
        status: row.status,
        categories: row.tenant.categories.map((category) => category.category),
        activeAssignmentCount: row.assignments.filter((assignment) => assignment.status === 'ACTIVE' && !assignment.endedAt).length,
        lastAssignmentMode: row.assignments[0]?.mode ?? null,
        lastWorkedAt: row.updatedAt,
      })),
    };
  }

  async create(actor: AuthUser, dto: CreateProviderProfileDto, meta: ProviderRequestMeta) {
    this.assertCanManageProfiles(actor);
    const slug = this.normalizeSlug(dto.publicSlug);
    await this.ensureSlugAvailable(slug);
    const skills = this.normalizeSkills(dto.skills);
    const payoutProfile = this.normalizePayoutProfile(dto);
    const data = {
      displayName: dto.displayName.trim(),
      headline: dto.headline?.trim(),
      bio: dto.bio?.trim(),
      verifiedSummary: dto.verifiedSummary?.trim(),
      publicSlug: slug,
      registryCode: await this.ensureRegistryCode(),
      skills: skills.length ? skills : Prisma.JsonNull,
      internalNotes: dto.internalNotes?.trim(),
    } as Prisma.ProviderProfileCreateInput;
    if (payoutProfile !== undefined) {
      (data as Record<string, unknown>).payoutProfile = payoutProfile;
    }
    const p = await this.prisma.providerProfile.create({
      data,
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'ProviderProfile',
      entityId: p.id,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: `Provider profile created: ${p.displayName}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.mapInternal(p);
  }

  async upsertMine(actor: AuthUser, dto: UpsertMyProviderProfileDto, meta: ProviderRequestMeta) {
    const existing = await this.prisma.providerProfile.findFirst({
      where: { userId: actor.userId, deletedAt: null },
    });
    const slug = this.normalizeSlug(dto.publicSlug);
    await this.ensureSlugAvailable(slug, existing?.id);
    const skills = this.normalizeSkills(dto.skills);
    const payoutProfile = this.normalizePayoutProfile(dto);

    const displayName = dto.displayName?.trim();
    if (!existing && !displayName) {
      const fallback = await this.prisma.user.findFirst({
        where: { id: actor.userId, deletedAt: null },
        select: { firstName: true, lastName: true, email: true },
      });
      const fallbackName = [fallback?.firstName, fallback?.lastName].filter(Boolean).join(' ').trim();
      if (!fallbackName && !fallback?.email) {
        throw new NotFoundException('User not found');
      }
      const created = await this.prisma.providerProfile.create({
        data: {
          userId: actor.userId,
          displayName: fallbackName || fallback!.email,
          headline: dto.headline?.trim(),
          bio: dto.bio?.trim(),
          publicSlug: slug,
          registryCode: await this.ensureRegistryCode(),
          skills: skills.length ? skills : Prisma.JsonNull,
          ...(payoutProfile !== undefined ? ({ payoutProfile } as Record<string, unknown>) : {}),
        } as Prisma.ProviderProfileCreateInput,
      });
      await this.audit.write({
        action: 'CREATE',
        entityType: 'ProviderProfile',
        entityId: created.id,
        actorUserId: actor.userId,
        correlationId: meta.correlationId,
        summary: `Provider self-profile created: ${created.displayName}`,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      return this.mapInternal(created);
    }

    if (!existing) {
      const created = await this.prisma.providerProfile.create({
        data: {
          userId: actor.userId,
          displayName: displayName!,
          headline: dto.headline?.trim(),
          bio: dto.bio?.trim(),
          publicSlug: slug,
          registryCode: await this.ensureRegistryCode(),
          skills: skills.length ? skills : Prisma.JsonNull,
          ...(payoutProfile !== undefined ? ({ payoutProfile } as Record<string, unknown>) : {}),
        } as Prisma.ProviderProfileCreateInput,
      });
      await this.audit.write({
        action: 'CREATE',
        entityType: 'ProviderProfile',
        entityId: created.id,
        actorUserId: actor.userId,
        correlationId: meta.correlationId,
        summary: `Provider self-profile created: ${created.displayName}`,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      return this.mapInternal(created);
    }

    const updateData = {
      displayName: displayName ?? undefined,
      headline: dto.headline === undefined ? undefined : dto.headline?.trim(),
      bio: dto.bio === undefined ? undefined : dto.bio?.trim(),
      publicSlug: dto.publicSlug === undefined ? undefined : (slug ?? null),
      skills: dto.skills === undefined ? undefined : skills.length ? skills : Prisma.JsonNull,
    } as Prisma.ProviderProfileUpdateInput;
    if (payoutProfile !== undefined) {
      (updateData as Record<string, unknown>).payoutProfile = payoutProfile;
    }
    const updated = await this.prisma.providerProfile.update({
      where: { id: existing.id },
      data: updateData,
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'ProviderProfile',
      entityId: updated.id,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: `Provider self-profile updated: ${updated.displayName}`,
      changes: dto as unknown as Prisma.InputJsonValue,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.mapInternal(updated);
  }

  async findMine(actor: AuthUser) {
    const found = await this.prisma.providerProfile.findFirst({
      where: { userId: actor.userId, deletedAt: null },
    });
    if (!found) {
      throw new NotFoundException('Provider profile not found');
    }
    const p = await this.withRegistryCode(found);
    return this.mapInternal(p);
  }

  async findOneInternal(actor: AuthUser, id: string) {
    await this.assertCanReadInternal(actor, id);
    const found = await this.prisma.providerProfile.findFirst({
      where: { id, deletedAt: null },
    });
    if (!found) {
      throw new NotFoundException('Profile not found');
    }
    const p = await this.withRegistryCode(found);
    return this.mapInternal(p);
  }

  async findOnePublic(id: string) {
    const found = await this.prisma.providerProfile.findFirst({
      where: { id, deletedAt: null },
    });
    if (!found) {
      throw new NotFoundException('Profile not found');
    }
    const p = await this.withRegistryCode(found);
    return this.mapPublic(p);
  }

  async lookupByCode(actor: AuthUser, rawCode: string) {
    this.assertCanLookupProfiles(actor);
    const code = rawCode.trim();
    if (!code) {
      throw new NotFoundException('Profile not found');
    }
    const p = await this.withRegistryCode(await this.findByCodeOrSlug(code));
    return {
      ...this.mapLookup(p),
      ...(await this.buildEmploymentHistory(p.id)),
    };
  }

  async findByCodeOrSlug(codeOrSlug: string) {
    const exactCode = codeOrSlug.trim().toUpperCase();
    const exactSlug = this.normalizeSlug(codeOrSlug);
    const p = await this.prisma.providerProfile.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { registryCode: exactCode },
          ...(exactSlug ? [{ publicSlug: exactSlug }] : []),
        ],
      },
    });
    if (!p) {
      throw new NotFoundException('Profile not found');
    }
    return p;
  }

  async update(actor: AuthUser, id: string, dto: UpdateProviderProfileDto, meta: ProviderRequestMeta) {
    await this.assertCanReadInternal(actor, id);
    this.assertCanManageProfiles(actor);
    const existing = await this.prisma.providerProfile.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Profile not found');
    }
    const slug = dto.publicSlug === undefined ? undefined : this.normalizeSlug(dto.publicSlug);
    await this.ensureSlugAvailable(slug, id);
    const skills = dto.skills === undefined ? undefined : this.normalizeSkills(dto.skills);
    const payoutProfile = this.normalizePayoutProfile(dto);

    const updateData = {
      displayName: dto.displayName?.trim(),
      headline: dto.headline === undefined ? undefined : dto.headline?.trim(),
      bio: dto.bio === undefined ? undefined : dto.bio?.trim(),
      verifiedSummary:
        dto.verifiedSummary === undefined ? undefined : dto.verifiedSummary?.trim(),
      publicSlug: dto.publicSlug === undefined ? undefined : (slug ?? null),
      skills: dto.skills === undefined ? undefined : skills?.length ? skills : Prisma.JsonNull,
      internalNotes:
        dto.internalNotes === undefined ? undefined : dto.internalNotes?.trim(),
    } as Prisma.ProviderProfileUpdateInput;
    if (payoutProfile !== undefined) {
      (updateData as Record<string, unknown>).payoutProfile = payoutProfile;
    }
    const updated = await this.prisma.providerProfile.update({
      where: { id },
      data: updateData,
    });
    const p = await this.withRegistryCode(updated);

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'ProviderProfile',
      entityId: id,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: `Provider profile updated: ${p.displayName}`,
      changes: dto as unknown as Prisma.InputJsonValue,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.mapInternal(p);
  }
}
