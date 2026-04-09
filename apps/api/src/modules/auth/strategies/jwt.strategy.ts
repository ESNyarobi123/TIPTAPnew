import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { AuthUser } from '../types/request-user.type';

export type JwtPayload = { sub: string; email?: string };
// When SUPER_ADMIN impersonates, we mint an access token for the target user with an impersonator hint.
export type JwtImpersonation = { impBy?: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('auth.accessSecret'),
    });
  }

  async validate(payload: JwtPayload & JwtImpersonation): Promise<AuthUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      include: { roleAssignments: true },
    });
    if (!user?.isActive) {
      throw new UnauthorizedException();
    }
    return {
      userId: user.id,
      email: user.email,
      impersonatorUserId: payload.impBy,
      roleAssignments: user.roleAssignments.map((a) => ({
        id: a.id,
        role: a.role,
        tenantId: a.tenantId,
        branchId: a.branchId,
        createdAt: a.createdAt,
      })),
    };
  }
}
