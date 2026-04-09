import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { QrTokenService } from './qr-token.service';
import type { QrValidatedContext } from './types/qr-resolve.types';

export type QrResolveResult =
  | { ok: true; context: QrValidatedContext }
  | { ok: false; reason: 'NOT_FOUND' | 'REVOKED' | 'EXPIRED' | 'INACTIVE' };

@Injectable()
export class QrResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: QrTokenService,
  ) {}

  async resolveSecretToken(rawToken: string): Promise<QrResolveResult> {
    const tokenHash = this.tokens.sha256Hex(rawToken.trim());
    const row = await this.prisma.qrCode.findFirst({
      where: { tokenHash },
    });
    if (!row) {
      return { ok: false, reason: 'NOT_FOUND' };
    }
    const now = new Date();
    if (row.status === 'REVOKED' || row.revokedAt != null) {
      return { ok: false, reason: 'REVOKED' };
    }
    if (row.expiresAt && row.expiresAt < now) {
      await this.prisma.qrCode.update({
        where: { id: row.id },
        data: { status: 'EXPIRED' },
      });
      return { ok: false, reason: 'EXPIRED' };
    }
    if (row.status !== 'ACTIVE') {
      return { ok: false, reason: 'INACTIVE' };
    }

    await this.prisma.qrCode.update({
      where: { id: row.id },
      data: {
        scanCount: { increment: 1 },
        lastScannedAt: now,
      },
    });

    const context: QrValidatedContext = {
      qrCodeId: row.id,
      publicRef: row.publicRef,
      tenantId: row.tenantId,
      branchId: row.branchId,
      type: row.type,
      staffId: row.staffId,
      diningTableId: row.diningTableId,
      beautyStationId: row.beautyStationId,
      metadata: row.metadata ?? null,
    };
    return { ok: true, context };
  }
}
