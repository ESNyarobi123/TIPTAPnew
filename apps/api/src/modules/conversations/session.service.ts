import { createHash, randomBytes } from 'node:crypto';
import { GoneException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { AuthUser } from '../auth/types/request-user.type';
import { userIsSuperAdmin } from '../auth/types/request-user.type';
import { TenantAccessService } from '../tenants/tenant-access.service';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly access: TenantAccessService,
  ) {}

  clientTokenHash(raw: string): string {
    return createHash('sha256').update(raw.trim(), 'utf8').digest('hex');
  }

  generateClientToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private ttlMs(): number {
    const h = this.config.get<number>('app.sessionDefaultTtlHours') ?? 24;
    return Math.max(1, h) * 3600 * 1000;
  }

  defaultExpiresAt(): Date {
    return new Date(Date.now() + this.ttlMs());
  }

  assertNotExpired(expiresAt: Date | null): void {
    if (expiresAt && expiresAt < new Date()) {
      throw new GoneException('Session expired');
    }
  }

  /** Customer channel: locate session by opaque token only (no internal session id). */
  async loadForCustomerByToken(sessionToken: string) {
    const hash = this.clientTokenHash(sessionToken);
    const session = await this.prisma.conversationSession.findFirst({
      where: { clientTokenHash: hash, deletedAt: null },
    });
    if (!session) {
      throw new UnauthorizedException('Invalid session token');
    }
    this.assertNotExpired(session.expiresAt);
    return session;
  }

  async loadForActor(
    sessionId: string,
    opts: { user?: AuthUser | null; sessionToken?: string | undefined },
  ) {
    const session = await this.prisma.conversationSession.findFirst({
      where: { id: sessionId, deletedAt: null },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    this.assertNotExpired(session.expiresAt);

    if (opts.user) {
      if (userIsSuperAdmin(opts.user)) {
        return session;
      }
      await this.access.assertReadableTenant(opts.user, session.tenantId);
      return session;
    }

    if (opts.sessionToken) {
      const hash = this.clientTokenHash(opts.sessionToken);
      if (!session.clientTokenHash || hash !== session.clientTokenHash) {
        throw new UnauthorizedException('Invalid session token');
      }
      return session;
    }

    throw new UnauthorizedException('Session token or authentication required');
  }
}
