import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit-logs/audit.service';
import type { AuthUser } from '../auth/types/request-user.type';
import { userIsSuperAdmin } from '../auth/types/request-user.type';
import type { CreateBranchDto } from './dto/create-branch.dto';
import type { UpdateBranchDto } from './dto/update-branch.dto';
import { TenantAccessService } from '../tenants/tenant-access.service';
import { assertOperatingHoursJson } from './operating-hours.validator';

export type BranchRequestMeta = {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
    private readonly audit: AuditService,
  ) {}

  private mapBranch(b: {
    id: string;
    tenantId: string;
    name: string;
    code: string;
    address: string | null;
    city: string | null;
    country: string | null;
    phone: string | null;
    email: string | null;
    latitude: Prisma.Decimal | null;
    longitude: Prisma.Decimal | null;
    timezone: string | null;
    operatingHours: Prisma.JsonValue | null;
    metadata: Prisma.JsonValue | null;
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
      latitude: b.latitude != null ? Number(b.latitude) : null,
      longitude: b.longitude != null ? Number(b.longitude) : null,
      timezone: b.timezone,
      operatingHours: b.operatingHours,
      metadata: b.metadata,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  }

  async createForTenant(
    actor: AuthUser,
    tenantId: string,
    dto: Omit<CreateBranchDto, 'tenantId'>,
    meta: BranchRequestMeta,
  ) {
    return this.create(actor, { ...dto, tenantId }, meta);
  }

  async create(actor: AuthUser, dto: CreateBranchDto, meta: BranchRequestMeta) {
    await this.access.assertWritableTenant(actor, dto.tenantId);
    const dup = await this.prisma.branch.findFirst({
      where: {
        tenantId: dto.tenantId,
        code: dto.code.trim(),
        deletedAt: null,
      },
    });
    if (dup) {
      throw new ConflictException('Branch code already exists for this tenant');
    }
    const oh =
      dto.operatingHours !== undefined ? assertOperatingHoursJson(dto.operatingHours) : undefined;
    const b = await this.prisma.branch.create({
      data: {
        tenantId: dto.tenantId,
        name: dto.name.trim(),
        code: dto.code.trim(),
        address: dto.address?.trim(),
        city: dto.city?.trim(),
        country: dto.country?.trim(),
        phone: dto.phone?.trim(),
        email: dto.email?.trim().toLowerCase(),
        timezone: dto.timezone?.trim(),
        latitude:
          dto.latitude != null ? new Prisma.Decimal(dto.latitude) : undefined,
        longitude:
          dto.longitude != null ? new Prisma.Decimal(dto.longitude) : undefined,
        ...(oh !== undefined ? { operatingHours: oh } : {}),
      },
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'Branch',
      entityId: b.id,
      tenantId: b.tenantId,
      branchId: b.id,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: `Created branch ${b.name}`,
      details: { code: b.code },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.mapBranch(b);
  }

  /** Public card for maps / booking UIs (no secrets). */
  async findPublicSnapshot(id: string) {
    const b = await this.prisma.branch.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        country: true,
        phone: true,
        timezone: true,
        operatingHours: true,
      },
    });
    if (!b) {
      throw new NotFoundException('Branch not found');
    }
    return {
      id: b.id,
      name: b.name,
      address: b.address,
      city: b.city,
      country: b.country,
      phone: b.phone,
      timezone: b.timezone,
      operatingHours: b.operatingHours,
    };
  }

  /** List branches for a single tenant (preferred over legacy query-param listing). */
  async findAllForTenant(actor: AuthUser, tenantId: string) {
    await this.access.assertReadableTenant(actor, tenantId);
    if (userIsSuperAdmin(actor)) {
      const rows = await this.prisma.branch.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
      return rows.map((r) => this.mapBranch(r));
    }
    const owners = this.access.getOwnerTenantIds(actor);
    if (owners.includes(tenantId)) {
      const rows = await this.prisma.branch.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((r) => this.mapBranch(r));
    }
    const readable = this.access.getReadableBranchIds(actor);
    const rows = await this.prisma.branch.findMany({
      where: {
        tenantId,
        deletedAt: null,
        id: { in: readable },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.mapBranch(r));
  }

  async findOne(actor: AuthUser, id: string) {
    await this.access.assertReadableBranch(actor, id);
    const b = await this.prisma.branch.findFirst({
      where: { id, deletedAt: null },
    });
    if (!b) {
      throw new NotFoundException('Branch not found');
    }
    return this.mapBranch(b);
  }

  async update(actor: AuthUser, id: string, dto: UpdateBranchDto, meta: BranchRequestMeta) {
    await this.access.assertWritableBranch(actor, id);
    const existing = await this.prisma.branch.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Branch not found');
    }
    const data: Prisma.BranchUpdateInput = {
      name: dto.name?.trim(),
      address: dto.address?.trim(),
      city: dto.city?.trim(),
      country: dto.country?.trim(),
      phone: dto.phone?.trim(),
      email: dto.email?.trim().toLowerCase(),
      timezone: dto.timezone?.trim(),
      latitude:
        dto.latitude != null ? new Prisma.Decimal(dto.latitude) : undefined,
      longitude:
        dto.longitude != null ? new Prisma.Decimal(dto.longitude) : undefined,
    };
    if ('operatingHours' in dto) {
      if (dto.operatingHours === null) {
        data.operatingHours = Prisma.DbNull;
      } else if (dto.operatingHours !== undefined) {
        data.operatingHours = assertOperatingHoursJson(dto.operatingHours);
      }
    }

    const b = await this.prisma.branch.update({
      where: { id },
      data,
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'Branch',
      entityId: id,
      tenantId: b.tenantId,
      branchId: b.id,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: `Updated branch ${b.name}`,
      changes: dto as unknown as Prisma.InputJsonValue,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.mapBranch(b);
  }
}
