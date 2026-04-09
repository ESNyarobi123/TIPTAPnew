import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import type { BusinessCategory, Tenant } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit-logs/audit.service';
import type { AuthUser } from '../auth/types/request-user.type';
import { userIsSuperAdmin } from '../auth/types/request-user.type';
import type { CreateSelfServeTenantDto } from './dto/create-self-serve-tenant.dto';
import type { CreateTenantDto } from './dto/create-tenant.dto';
import type { PatchTenantCategoryDto } from './dto/patch-tenant-category.dto';
import type { UpsertTenantLandingDto } from './dto/upsert-tenant-landing.dto';
import type { UpdateTenantDto } from './dto/update-tenant.dto';
import type { UpsertTenantCategoryDto } from './dto/upsert-tenant-category.dto';
import { TenantAccessService } from './tenant-access.service';

export type TenantRequestMeta = {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
    private readonly audit: AuditService,
  ) {}

  private mapTenant(t: Tenant & { categories?: { category: BusinessCategory; enabled: boolean; settings: Prisma.JsonValue | null }[] }) {
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      legalName: t.legalName,
      email: t.email,
      phone: t.phone,
      subscriptionPlan: t.subscriptionPlan,
      subscriptionStatus: t.subscriptionStatus,
      metadata: t.metadata,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      categories:
        t.categories?.map((c) => ({
          category: c.category,
          enabled: c.enabled,
          settings: c.settings,
        })) ?? [],
    };
  }

  private mapLanding(p: {
    id: string;
    tenantId: string;
    slug: string;
    title: string | null;
    subtitle: string | null;
    heroCtaText: string | null;
    heroCtaHref: string | null;
    theme: Prisma.JsonValue | null;
    sections: Prisma.JsonValue | null;
    isPublished: boolean;
    publishedAt: Date | null;
    updatedAt: Date;
  }) {
    return {
      id: p.id,
      tenantId: p.tenantId,
      slug: p.slug,
      title: p.title,
      subtitle: p.subtitle,
      heroCtaText: p.heroCtaText,
      heroCtaHref: p.heroCtaHref,
      theme: p.theme,
      sections: p.sections,
      isPublished: p.isPublished,
      publishedAt: p.publishedAt,
      updatedAt: p.updatedAt,
    };
  }

  private mapBranchSummary(b: {
    id: string;
    tenantId: string;
    name: string;
    code: string;
    address: string | null;
    city: string | null;
    country: string | null;
    phone: string | null;
    email: string | null;
    timezone: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: b.id,
      tenantId: b.tenantId,
      name: b.name,
      code: b.code,
      address: b.address,
      city: b.city,
      country: b.country,
      phone: b.phone,
      email: b.email,
      timezone: b.timezone,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  }

  private slugify(raw: string): string {
    const normalized = raw
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return normalized.slice(0, 80) || 'workspace';
  }

  private async nextAvailableSlug(seed: string): Promise<string> {
    const base = this.slugify(seed);
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const suffix = attempt === 0 ? '' : `-${randomBytes(2).toString('hex')}`;
      const candidate = `${base.slice(0, Math.max(2, 80 - suffix.length))}${suffix}`;
      const taken = await this.prisma.tenant.findFirst({
        where: { slug: candidate, deletedAt: null },
        select: { id: true },
      });
      if (!taken) {
        return candidate;
      }
    }
    return `workspace-${randomBytes(3).toString('hex')}`;
  }

  async create(actor: AuthUser, dto: CreateTenantDto, meta: TenantRequestMeta) {
    if (!userIsSuperAdmin(actor)) {
      throw new ForbiddenException('Only SUPER_ADMIN can create tenants');
    }
    const slug = dto.slug.trim().toLowerCase();
    const taken = await this.prisma.tenant.findFirst({
      where: { slug, deletedAt: null },
    });
    if (taken) {
      throw new ConflictException('Tenant slug already in use');
    }
    if (dto.ownerUserId) {
      const owner = await this.prisma.user.findFirst({
        where: { id: dto.ownerUserId, deletedAt: null },
      });
      if (!owner) {
        throw new BadRequestException('ownerUserId not found');
      }
    }

    const tenant = await this.prisma.$transaction(async (tx) => {
      const t = await tx.tenant.create({
        data: {
          name: dto.name.trim(),
          slug,
          status: dto.status ?? 'TRIAL',
          legalName: dto.legalName?.trim(),
          email: dto.email?.trim().toLowerCase(),
          phone: dto.phone?.trim(),
        },
      });

      const cats = dto.enabledCategories ?? [];
      for (const c of cats) {
        await tx.tenantCategory.create({
          data: {
            tenantId: t.id,
            category: c,
            enabled: true,
          },
        });
      }

      if (dto.ownerUserId) {
        this.access.assertRoleAssignmentShape('TENANT_OWNER', t.id, undefined);
        await tx.userRoleAssignment.create({
          data: {
            userId: dto.ownerUserId,
            role: 'TENANT_OWNER',
            tenantId: t.id,
          },
        });
      }

      return tx.tenant.findUniqueOrThrow({
        where: { id: t.id },
        include: { categories: true },
      });
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'Tenant',
      entityId: tenant.id,
      tenantId: tenant.id,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: `Created tenant ${tenant.name}`,
      details: { slug: tenant.slug, ownerUserId: dto.ownerUserId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.mapTenant(tenant);
  }

  async createSelfServe(actor: AuthUser, dto: CreateSelfServeTenantDto, meta: TenantRequestMeta) {
    const displayName = dto.brandName?.trim() || dto.name.trim();
    const legalName = dto.brandName?.trim() ? dto.name.trim() : undefined;
    const slug = await this.nextAvailableSlug(displayName);
    const branchAddress = dto.branch.address?.trim() || dto.address?.trim() || undefined;
    const branchCity = dto.branch.city?.trim() || dto.city?.trim() || undefined;
    const branchCountry = dto.branch.country?.trim() || dto.country?.trim() || undefined;
    const branchPhone = dto.branch.phone?.trim() || dto.phone?.trim() || undefined;
    const branchEmail = dto.branch.email?.trim().toLowerCase() || dto.businessEmail?.trim().toLowerCase() || undefined;
    const branchTimezone = dto.branch.timezone?.trim() || undefined;
    const categorySettings = {
      subtype: dto.subtype?.trim() || null,
      source: 'SELF_SERVE_ONBOARDING',
      requestedAt: new Date().toISOString(),
    } satisfies Record<string, unknown>;

    const submittedAt = new Date().toISOString();

    const onboardingMeta = {
      source: 'SELF_SERVE_ONBOARDING',
      createdByUserId: actor.userId,
      submittedAt,
      requestedCategory: dto.category,
      requestedSubtype: dto.subtype?.trim() || null,
      businessAddress: dto.address?.trim() || null,
      city: dto.city?.trim() || null,
      country: dto.country?.trim() || null,
      approval: {
        workflowStatus: 'PENDING',
        riskLevel: 'MEDIUM',
        requestedAt: submittedAt,
        submittedAt,
        reviewNotes: null,
        nextActions: 'Verify business profile, branch readiness, and payment configuration before activation.',
        checklist: {
          legalIdentityVerified: false,
          contactVerified: false,
          paymentReady: false,
          branchReady: false,
          catalogReady: false,
          staffingReady: false,
          channelReady: false,
        },
        timeline: [],
      },
    } satisfies Record<string, unknown>;

    const created = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: displayName,
          slug,
          status: 'TRIAL',
          legalName,
          email: dto.businessEmail?.trim().toLowerCase(),
          phone: dto.phone?.trim(),
          metadata: onboardingMeta as Prisma.InputJsonValue,
        },
      });

      await tx.tenantCategory.create({
        data: {
          tenantId: tenant.id,
          category: dto.category,
          enabled: true,
          settings: categorySettings as Prisma.InputJsonValue,
        },
      });

      this.access.assertRoleAssignmentShape('TENANT_OWNER', tenant.id, undefined);
      await tx.userRoleAssignment.create({
        data: {
          userId: actor.userId,
          role: 'TENANT_OWNER',
          tenantId: tenant.id,
        },
      });

      const branch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: dto.branch.name.trim(),
          code: dto.branch.code.trim().toUpperCase(),
          address: branchAddress,
          city: branchCity,
          country: branchCountry,
          phone: branchPhone,
          email: branchEmail,
          timezone: branchTimezone,
        },
      });

      const fullTenant = await tx.tenant.findUniqueOrThrow({
        where: { id: tenant.id },
        include: { categories: true },
      });

      return { tenant: fullTenant, branch };
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'Tenant',
      entityId: created.tenant.id,
      tenantId: created.tenant.id,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: `Self-serve tenant created: ${created.tenant.name}`,
      details: {
        slug: created.tenant.slug,
        category: dto.category,
        branchId: created.branch.id,
        branchCode: created.branch.code,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'Branch',
      entityId: created.branch.id,
      tenantId: created.tenant.id,
      branchId: created.branch.id,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: `First branch created: ${created.branch.name}`,
      details: { code: created.branch.code },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      tenant: this.mapTenant(created.tenant),
      branch: this.mapBranchSummary(created.branch),
      access: {
        role: 'TENANT_OWNER',
        tenantStatus: created.tenant.status,
      },
    };
  }

  async findAll(actor: AuthUser) {
    if (userIsSuperAdmin(actor)) {
      const rows = await this.prisma.tenant.findMany({
        where: { deletedAt: null },
        include: { categories: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return rows.map((t) => this.mapTenant(t));
    }

    const ownerIds = this.access.getOwnerTenantIds(actor);
    const managed = this.access.getManagedBranchIds(actor);
    const fromBranches =
      managed.length > 0
        ? (
            await this.prisma.branch.findMany({
              where: { id: { in: managed }, deletedAt: null },
              select: { tenantId: true },
            })
          ).map((b) => b.tenantId)
        : [];
    const staffTenantIds = this.access.getStaffTenantIds(actor);
    const ids = [...new Set([...ownerIds, ...fromBranches, ...staffTenantIds])];
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.prisma.tenant.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include: { categories: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((t) => this.mapTenant(t));
  }

  async findOne(actor: AuthUser, id: string) {
    await this.access.assertReadableTenant(actor, id);
    const t = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
      include: { categories: true },
    });
    if (!t) {
      throw new NotFoundException('Tenant not found');
    }
    return this.mapTenant(t);
  }

  async update(actor: AuthUser, id: string, dto: UpdateTenantDto, meta: TenantRequestMeta) {
    await this.access.assertWritableTenant(actor, id);
    const existing = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Tenant not found');
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        status: dto.status,
        legalName: dto.legalName?.trim(),
        email: dto.email?.trim().toLowerCase(),
        phone: dto.phone?.trim(),
      },
      include: { categories: true },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'Tenant',
      entityId: id,
      tenantId: id,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: `Updated tenant ${updated.name}`,
      changes: dto as unknown as Prisma.InputJsonValue,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.mapTenant(updated);
  }

  async getLanding(actor: AuthUser, tenantId: string) {
    await this.access.assertReadableTenant(actor, tenantId);
    const t = await this.prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
    if (!t) throw new NotFoundException('Tenant not found');
    const p = await this.prisma.tenantLandingPage.findFirst({ where: { tenantId, deletedAt: null } });
    if (!p) {
      // Return sensible defaults (draft) without creating a row yet.
      return {
        tenantId,
        slug: t.slug,
        title: t.name,
        subtitle: null,
        heroCtaText: 'Chat on WhatsApp',
        heroCtaHref: null,
        theme: null,
        sections: null,
        isPublished: false,
        publishedAt: null,
        updatedAt: t.updatedAt,
      };
    }
    return this.mapLanding(p);
  }

  async upsertLanding(actor: AuthUser, tenantId: string, dto: UpsertTenantLandingDto, meta: TenantRequestMeta) {
    await this.access.assertWritableTenant(actor, tenantId);
    const t = await this.prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
    if (!t) throw new NotFoundException('Tenant not found');
    const slug = (dto.slug?.trim().toLowerCase() || t.slug).replace(/[^a-z0-9\-]/g, '-');
    const taken = await this.prisma.tenantLandingPage.findFirst({
      where: { slug, deletedAt: null, NOT: { tenantId } },
    });
    if (taken) {
      throw new ConflictException('Landing slug already in use');
    }

    const isPublished = dto.isPublished ?? false;
    const p = await this.prisma.tenantLandingPage.upsert({
      where: { tenantId },
      create: {
        tenantId,
        slug,
        title: dto.title?.trim() ?? t.name,
        subtitle: dto.subtitle?.trim(),
        heroCtaText: dto.heroCtaText?.trim() ?? 'Chat on WhatsApp',
        heroCtaHref: dto.heroCtaHref?.trim(),
        theme: dto.theme ? (dto.theme as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        sections: dto.sections ? (dto.sections as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        isPublished,
        publishedAt: isPublished ? new Date() : null,
      },
      update: {
        slug,
        ...(dto.title !== undefined ? { title: dto.title?.trim() } : {}),
        ...(dto.subtitle !== undefined ? { subtitle: dto.subtitle?.trim() } : {}),
        ...(dto.heroCtaText !== undefined ? { heroCtaText: dto.heroCtaText?.trim() } : {}),
        ...(dto.heroCtaHref !== undefined ? { heroCtaHref: dto.heroCtaHref?.trim() } : {}),
        ...(dto.theme !== undefined
          ? { theme: dto.theme ? (dto.theme as unknown as Prisma.InputJsonValue) : Prisma.JsonNull }
          : {}),
        ...(dto.sections !== undefined
          ? { sections: dto.sections ? (dto.sections as unknown as Prisma.InputJsonValue) : Prisma.JsonNull }
          : {}),
        ...(dto.isPublished !== undefined
          ? {
              isPublished,
              publishedAt: isPublished ? new Date() : null,
            }
          : {}),
      },
    });

    await this.audit.write({
      action: 'CONFIG_CHANGE',
      entityType: 'TenantLandingPage',
      entityId: p.id,
      tenantId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Tenant landing page updated',
      changes: dto as unknown as Prisma.InputJsonValue,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.mapLanding(p);
  }

  /**
   * Active services for public landing: respects enabled verticals (Beauty / Food) and uploaded catalog images.
   */
  private async loadLandingCatalog(tenantId: string) {
    const verticals = await this.prisma.tenantCategory.findMany({
      where: { tenantId, enabled: true },
      select: { category: true },
    });
    const enabled = new Set(verticals.map((v) => v.category));

    const [beautyServices, menuItems] = await Promise.all([
      enabled.has('BEAUTY_GROOMING')
        ? this.prisma.beautyService.findMany({
            where: { tenantId, deletedAt: null, isActive: true },
            orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
            take: 48,
            include: {
              category: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      enabled.has('FOOD_DINING')
        ? this.prisma.diningMenuItem.findMany({
            where: { tenantId, deletedAt: null, isAvailable: true },
            orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
            take: 48,
            include: {
              category: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    return {
      beautyServices: beautyServices.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        durationMin: row.durationMin,
        priceCents: row.priceCents,
        currency: row.currency,
        imageUrl: row.imageUrl,
        categoryName: row.category.name,
      })),
      menuItems: menuItems.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        priceCents: row.priceCents,
        currency: row.currency,
        imageUrl: row.imageUrl,
        categoryName: row.category.name,
      })),
    };
  }

  async getLandingPublic(slug: string) {
    const s = slug.trim().toLowerCase();
    const p = await this.prisma.tenantLandingPage.findFirst({
      where: { slug: s, isPublished: true, deletedAt: null },
      include: {
        tenant: { select: { name: true, slug: true } },
      },
    });
    if (!p) throw new NotFoundException('Landing page not found');
    const catalog = await this.loadLandingCatalog(p.tenantId);
    return {
      slug: p.slug,
      tenantName: p.tenant.name,
      tenantSlug: p.tenant.slug,
      title: p.title,
      subtitle: p.subtitle,
      heroCtaText: p.heroCtaText,
      heroCtaHref: p.heroCtaHref,
      theme: p.theme,
      sections: p.sections,
      publishedAt: p.publishedAt,
      updatedAt: p.updatedAt,
      catalog,
    };
  }

  async listCategories(actor: AuthUser, tenantId: string) {
    await this.access.assertReadableTenant(actor, tenantId);
    const rows = await this.prisma.tenantCategory.findMany({
      where: { tenantId },
      orderBy: { category: 'asc' },
    });
    return rows.map((c) => ({
      id: c.id,
      category: c.category,
      enabled: c.enabled,
      settings: c.settings,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  async upsertCategory(
    actor: AuthUser,
    tenantId: string,
    dto: UpsertTenantCategoryDto,
    meta: TenantRequestMeta,
  ) {
    await this.access.assertWritableTenant(actor, tenantId);
    const row = await this.prisma.tenantCategory.upsert({
      where: {
        tenantId_category: { tenantId, category: dto.category },
      },
      create: {
        tenantId,
        category: dto.category,
        enabled: dto.enabled ?? true,
        settings: dto.settings as Prisma.InputJsonValue | undefined,
      },
      update: {
        enabled: dto.enabled ?? true,
        settings: dto.settings as Prisma.InputJsonValue | undefined,
      },
    });

    await this.audit.write({
      action: 'CONFIG_CHANGE',
      entityType: 'TenantCategory',
      entityId: row.id,
      tenantId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: `Upsert category ${dto.category} for tenant`,
      details: { enabled: row.enabled },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return row;
  }

  async patchCategory(
    actor: AuthUser,
    tenantId: string,
    category: BusinessCategory,
    dto: PatchTenantCategoryDto,
    meta: TenantRequestMeta,
  ) {
    await this.access.assertWritableTenant(actor, tenantId);
    let row;
    try {
      row = await this.prisma.tenantCategory.update({
        where: {
          tenantId_category: { tenantId, category },
        },
        data: {
          enabled: dto.enabled,
          settings: dto.settings as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Tenant category not found');
      }
      throw e;
    }

    await this.audit.write({
      action: 'CONFIG_CHANGE',
      entityType: 'TenantCategory',
      entityId: row.id,
      tenantId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: `Patched category ${category}`,
      details: dto as unknown as Prisma.InputJsonValue,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return row;
  }
}
