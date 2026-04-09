import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { QrType } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit-logs/audit.service';
import type { AuthUser } from '../auth/types/request-user.type';
import { userIsSuperAdmin } from '../auth/types/request-user.type';
import { TenantAccessService } from '../tenants/tenant-access.service';
import type { CreateQrDto } from './dto/create-qr.dto';
import { QrTokenService } from './qr-token.service';

export type QrRequestMeta = {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

const qrOutputInclude = Prisma.validator<Prisma.QrCodeDefaultArgs>()({
  include: {
    branch: { select: { id: true, name: true, code: true } },
    staff: {
      select: {
        id: true,
        displayName: true,
        publicHandle: true,
        providerProfile: { select: { registryCode: true } },
      },
    },
    diningTable: { select: { id: true, code: true, label: true } },
    beautyStation: { select: { id: true, code: true, label: true } },
  },
});

type QrOutputRow = Prisma.QrCodeGetPayload<typeof qrOutputInclude>;

@Injectable()
export class QrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
    private readonly audit: AuditService,
    private readonly tokens: QrTokenService,
  ) {}

  private customerLaunch(rawToken: string) {
    return {
      channel: 'WHATSAPP' as const,
      prefillText: `QR:${rawToken}`,
      tokenFormatHint: 'QR:<secret>',
      instructions:
        'Let the customer scan the QR, open WhatsApp, then send the prefilled message to start the guided menu.',
    };
  }

  private mapLinkedTarget(row: QrOutputRow) {
    if (row.staff) {
      return {
        kind: 'STAFF' as const,
        id: row.staff.id,
        label: row.staff.displayName,
        handle: row.staff.publicHandle,
        providerCode: row.staff.providerProfile?.registryCode ?? null,
      };
    }
    if (row.diningTable) {
      return {
        kind: 'TABLE' as const,
        id: row.diningTable.id,
        label: row.diningTable.label ?? row.diningTable.code,
        code: row.diningTable.code,
      };
    }
    if (row.beautyStation) {
      return {
        kind: 'STATION' as const,
        id: row.beautyStation.id,
        label: row.beautyStation.label ?? row.beautyStation.code,
        code: row.beautyStation.code,
      };
    }
    return {
      kind: 'BUSINESS' as const,
      label: row.branch?.name ?? null,
    };
  }

  private mapQr(row: QrOutputRow) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      type: row.type,
      status: row.status,
      publicRef: row.publicRef,
      staffId: row.staffId,
      diningTableId: row.diningTableId,
      beautyStationId: row.beautyStationId,
      metadata: row.metadata,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      scanCount: row.scanCount,
      lastScannedAt: row.lastScannedAt,
      rotatedAt: row.rotatedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      branch: row.branch
        ? {
            id: row.branch.id,
            name: row.branch.name,
            code: row.branch.code,
          }
        : null,
      linkedTarget: this.mapLinkedTarget(row),
    };
  }

  private async findQrForOutput(id: string): Promise<QrOutputRow> {
    const row = await this.prisma.qrCode.findFirst({
      where: { id },
      ...qrOutputInclude,
    });
    if (!row) {
      throw new NotFoundException('QR not found');
    }
    return row;
  }

  async createForTenant(
    actor: AuthUser,
    tenantId: string,
    dto: Omit<CreateQrDto, 'tenantId'>,
    meta: QrRequestMeta,
  ) {
    return this.create(actor, { ...dto, tenantId }, meta);
  }

  private async assertQrManage(actor: AuthUser, tenantId: string, branchId?: string | null) {
    await this.access.assertWritableTenant(actor, tenantId);
    if (userIsSuperAdmin(actor)) {
      return;
    }
    if (this.access.getOwnerTenantIds(actor).includes(tenantId)) {
      return;
    }
    const managed = this.access.getManagedBranchIds(actor);
    if (branchId && managed.includes(branchId)) {
      return;
    }
    throw new ForbiddenException('Cannot manage QR for this scope');
  }

  private async validateTypedLinks(
    tenantId: string,
    type: QrType,
    dto: CreateQrDto,
  ): Promise<void> {
    if (dto.branchId) {
      await this.access.assertBranchBelongsToTenant(dto.branchId, tenantId);
    }
    switch (type) {
      case 'STAFF_QR': {
        if (!dto.staffId) {
          throw new BadRequestException('STAFF_QR requires staffId');
        }
        const st = await this.prisma.staff.findFirst({
          where: { id: dto.staffId, tenantId, deletedAt: null },
        });
        if (!st) {
          throw new BadRequestException('staffId not found in tenant');
        }
        break;
      }
      case 'TABLE_QR': {
        if (!dto.diningTableId) {
          throw new BadRequestException('TABLE_QR requires diningTableId');
        }
        const t = await this.prisma.diningTable.findFirst({
          where: { id: dto.diningTableId, tenantId, deletedAt: null },
        });
        if (!t) {
          throw new BadRequestException('diningTableId not found in tenant');
        }
        break;
      }
      case 'STATION_QR': {
        if (!dto.beautyStationId) {
          throw new BadRequestException('STATION_QR requires beautyStationId');
        }
        const s = await this.prisma.beautyStation.findFirst({
          where: { id: dto.beautyStationId, tenantId, deletedAt: null },
        });
        if (!s) {
          throw new BadRequestException('beautyStationId not found in tenant');
        }
        break;
      }
      case 'BUSINESS_QR':
        break;
      default:
        break;
    }
  }

  private async uniquePublicRef(tenantId: string): Promise<string> {
    for (let i = 0; i < 8; i++) {
      const ref = this.tokens.generatePublicRef();
      const clash = await this.prisma.qrCode.findFirst({
        where: { tenantId, publicRef: ref },
      });
      if (!clash) {
        return ref;
      }
    }
    throw new BadRequestException('Could not allocate publicRef');
  }

  async create(actor: AuthUser, dto: CreateQrDto, meta: QrRequestMeta) {
    const tenantId = dto.tenantId;
    await this.assertQrManage(actor, tenantId, dto.branchId);
    await this.validateTypedLinks(tenantId, dto.type, dto);

    const raw = this.tokens.generateRawToken();
    const tokenHash = this.tokens.sha256Hex(raw);
    const publicRef = await this.uniquePublicRef(tenantId);

    const row = await this.prisma.qrCode.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        type: dto.type,
        status: 'ACTIVE',
        tokenHash,
        publicRef,
        staffId: dto.staffId,
        diningTableId: dto.diningTableId,
        beautyStationId: dto.beautyStationId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        metadata: dto.metadata === undefined ? undefined : (dto.metadata as Prisma.InputJsonValue),
      },
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'QrCode',
      entityId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: `QR created (${row.type})`,
      details: { publicRef: row.publicRef },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const output = await this.findQrForOutput(row.id);
    return {
      ...this.mapQr(output),
      /** Shown once — store securely client-side for scan payloads. */
      rawToken: raw,
      customerLaunch: this.customerLaunch(raw),
    };
  }

  async findAll(actor: AuthUser, tenantId: string) {
    if (!tenantId?.trim()) {
      throw new BadRequestException('tenantId query is required');
    }
    await this.access.assertReadableTenant(actor, tenantId);
    const rows = await this.prisma.qrCode.findMany({
      where: { tenantId },
      ...qrOutputInclude,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return rows.map((r) => this.mapQr(r));
  }

  async findOne(actor: AuthUser, id: string) {
    const row = await this.findQrForOutput(id);
    await this.assertQrManage(actor, row.tenantId, row.branchId);
    return this.mapQr(row);
  }

  async revoke(actor: AuthUser, id: string, meta: QrRequestMeta) {
    const row = await this.prisma.qrCode.findFirst({ where: { id } });
    if (!row) {
      throw new NotFoundException('QR not found');
    }
    await this.assertQrManage(actor, row.tenantId, row.branchId);
    const now = new Date();
    const updated = await this.prisma.qrCode.update({
      where: { id },
      data: { status: 'REVOKED', revokedAt: now },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'QrCode',
      entityId: id,
      tenantId: row.tenantId,
      branchId: row.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'QR revoked',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const output = await this.findQrForOutput(updated.id);
    return this.mapQr(output);
  }

  async rotate(actor: AuthUser, id: string, meta: QrRequestMeta) {
    const row = await this.prisma.qrCode.findFirst({ where: { id } });
    if (!row) {
      throw new NotFoundException('QR not found');
    }
    await this.assertQrManage(actor, row.tenantId, row.branchId);
    if (row.status !== 'ACTIVE' || row.revokedAt != null) {
      throw new BadRequestException('Only active QR codes can be rotated');
    }
    const raw = this.tokens.generateRawToken();
    const tokenHash = this.tokens.sha256Hex(raw);
    const now = new Date();
    const updated = await this.prisma.qrCode.update({
      where: { id },
      data: {
        tokenHash,
        rotatedAt: now,
        scanCount: 0,
      },
    });

    await this.audit.write({
      action: 'CONFIG_CHANGE',
      entityType: 'QrCode',
      entityId: id,
      tenantId: row.tenantId,
      branchId: row.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'QR token rotated',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const output = await this.findQrForOutput(updated.id);
    return {
      ...this.mapQr(output),
      rawToken: raw,
      customerLaunch: this.customerLaunch(raw),
    };
  }
}
