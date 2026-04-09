import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit-logs/audit.service';
import type { AuthUser } from './types/request-user.type';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { userIsSuperAdmin } from './types/request-user.type';

const BCRYPT_ROUNDS = 12;

export type AuthRequestMeta = {
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
};

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function ttlToSeconds(ttl: string): number {
  const m = ttl.match(/^(\d+)([smhd])$/i);
  if (!m) {
    return 900;
  }
  const n = parseInt(m[1], 10);
  switch (m[2].toLowerCase()) {
    case 's':
      return n;
    case 'm':
      return n * 60;
    case 'h':
      return n * 3600;
    case 'd':
      return n * 86400;
    default:
      return 900;
  }
}

function randomRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private accessExpiresSeconds(): number {
    const ttl = this.config.get<string>('auth.accessExpiresIn') ?? '15m';
    return ttlToSeconds(ttl);
  }

  private refreshExpiresMs(): number {
    const ttl = this.config.get<string>('auth.refreshExpiresIn') ?? '7d';
    return ttlToSeconds(ttl) * 1000;
  }

  async register(dto: RegisterDto, meta: AuthRequestMeta) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const appEnv = this.config.get<string>('app.env') ?? 'development';
    const allowBootstrapFlag =
      this.config.get<boolean>('auth.allowBootstrapSuperAdmin') === true;
    const allowBootstrapSuper =
      appEnv !== 'production' || allowBootstrapFlag;

    const user = await this.prisma.$transaction(async (tx) => {
      const count = await tx.user.count();
      return tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.firstName?.trim(),
          lastName: dto.lastName?.trim(),
          phone: dto.phone?.trim(),
          passwordChangedAt: new Date(),
          roleAssignments:
            count === 0 && allowBootstrapSuper
              ? {
                  create: [{ role: 'SUPER_ADMIN' }],
                }
              : undefined,
        },
        include: { roleAssignments: true },
      });
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'User',
      entityId: user.id,
      actorUserId: user.id,
      summary: 'User registered',
      details: { email: user.email, bootstrapSuper: user.roleAssignments.some((r) => r.role === 'SUPER_ADMIN') },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });

    return this.issueTokensForUser(user.id, user.email, meta);
  }

  async login(dto: LoginDto, meta: AuthRequestMeta) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { roleAssignments: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.write({
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      actorUserId: user.id,
      summary: 'Login success',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });

    return this.issueTokensForUser(user.id, user.email, meta);
  }

  private async issueTokensForUser(
    userId: string,
    email: string,
    meta: AuthRequestMeta,
  ) {
    const accessTtl = this.accessExpiresSeconds();
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      { expiresIn: accessTtl },
    );

    const rawRefresh = randomRefreshToken();
    const tokenHash = sha256Hex(rawRefresh);
    const expiresAt = new Date(Date.now() + this.refreshExpiresMs());

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return {
      user: { id: userId, email },
      accessToken,
      refreshToken: rawRefresh,
      expiresIn: accessTtl,
      tokenType: 'Bearer' as const,
    };
  }

  async refresh(refreshToken: string, meta: AuthRequestMeta) {
    const tokenHash = sha256Hex(refreshToken.trim());
    const now = new Date();
    const record = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: { include: { roleAssignments: true } } },
    });
    if (!record?.user || !record.user.isActive || record.user.deletedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const revoked = record.revokedAt != null;
    const expired = record.expiresAt <= now;
    if (revoked || expired) {
      if (revoked) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: record.userId, revokedAt: null },
          data: { revokedAt: now },
        });
        await this.audit.write({
          action: 'ACCESS',
          entityType: 'Auth',
          entityId: record.userId,
          actorUserId: record.userId,
          summary: 'Refresh token reuse detected — all refresh tokens revoked',
          details: { tokenId: record.id },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          correlationId: meta.correlationId,
        });
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: now },
    });

    const rotated = randomRefreshToken();
    const newHash = sha256Hex(rotated);
    const expiresAt = new Date(Date.now() + this.refreshExpiresMs());

    await this.prisma.refreshToken.create({
      data: {
        userId: record.userId,
        tokenHash: newHash,
        expiresAt,
        lastUsedAt: new Date(),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    const accessTtl = this.accessExpiresSeconds();
    const accessToken = await this.jwt.signAsync(
      { sub: record.user.id, email: record.user.email },
      { expiresIn: accessTtl },
    );

    return {
      user: { id: record.user.id, email: record.user.email },
      accessToken,
      refreshToken: rotated,
      expiresIn: accessTtl,
      tokenType: 'Bearer' as const,
    };
  }

  async logout(refreshToken: string, meta: AuthRequestMeta, actorUserId?: string) {
    const tokenHash = sha256Hex(refreshToken.trim());
    const record = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null },
    });
    if (record) {
      await this.prisma.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.write({
      action: 'LOGOUT',
      entityType: 'Session',
      entityId: record?.id,
      actorUserId: actorUserId ?? record?.userId,
      summary: 'Logout',
      details: { hadSession: !!record },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });

    return { success: true };
  }

  async logoutAll(userId: string, meta: AuthRequestMeta) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.write({
      action: 'LOGOUT',
      entityType: 'User',
      entityId: userId,
      actorUserId: userId,
      summary: 'Logout all sessions',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });

    return { success: true };
  }

  /** Optional bearer validation for hybrid public endpoints (e.g. conversation session). */
  async loadUserFromAccessToken(accessToken: string): Promise<AuthUser | null> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(accessToken, {
        secret: this.config.getOrThrow<string>('auth.accessSecret'),
      });
      const user = await this.prisma.user.findFirst({
        where: { id: payload.sub, deletedAt: null },
        include: { roleAssignments: true },
      });
      if (!user?.isActive) {
        return null;
      }
      return {
        userId: user.id,
        email: user.email,
        roleAssignments: user.roleAssignments.map((a) => ({
          id: a.id,
          role: a.role,
          tenantId: a.tenantId,
          branchId: a.branchId,
          createdAt: a.createdAt,
        })),
      };
    } catch {
      return null;
    }
  }

  async me(user: AuthUser) {
    const full = await this.prisma.user.findFirst({
      where: { id: user.userId, deletedAt: null },
      include: { roleAssignments: true },
    });
    if (!full) {
      throw new UnauthorizedException();
    }
    const impersonator =
      user.impersonatorUserId && user.impersonatorUserId !== user.userId
        ? await this.prisma.user.findFirst({
            where: { id: user.impersonatorUserId, deletedAt: null },
            select: { id: true, email: true, firstName: true, lastName: true },
          })
        : null;
    const name = [full.firstName, full.lastName].filter(Boolean).join(' ').trim();
    return {
      id: full.id,
      email: full.email,
      name: name || full.email,
      firstName: full.firstName,
      lastName: full.lastName,
      phone: full.phone,
      isActive: full.isActive,
      roles: full.roleAssignments.map((a) => ({
        role: a.role,
        tenantId: a.tenantId,
        branchId: a.branchId,
      })),
      impersonation: impersonator
        ? {
            by: {
              id: impersonator.id,
              email: impersonator.email,
              name:
                [impersonator.firstName, impersonator.lastName].filter(Boolean).join(' ').trim() ||
                impersonator.email,
            },
          }
        : null,
    };
  }

  async impersonate(actor: AuthUser, targetUserId: string, meta: AuthRequestMeta) {
    if (!userIsSuperAdmin(actor)) {
      throw new ForbiddenException('SUPER_ADMIN required');
    }
    if (!targetUserId || typeof targetUserId !== 'string') {
      throw new NotFoundException('Target user not found');
    }
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, deletedAt: null },
    });
    if (!target || !target.isActive) {
      throw new NotFoundException('Target user not found');
    }
    const accessTtl = this.accessExpiresSeconds();
    const accessToken = await this.jwt.signAsync(
      { sub: target.id, email: target.email, impBy: actor.userId },
      { expiresIn: accessTtl },
    );

    await this.audit.write({
      action: 'ACCESS',
      entityType: 'Impersonation',
      entityId: target.id,
      actorUserId: actor.userId,
      summary: 'Impersonation started',
      details: { targetUserId: target.id, targetEmail: target.email },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });

    return {
      user: { id: target.id, email: target.email },
      accessToken,
      expiresIn: accessTtl,
      tokenType: 'Bearer' as const,
      impersonation: { by: actor.userId },
    };
  }
}
