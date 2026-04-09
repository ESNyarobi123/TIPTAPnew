import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RoleCode } from '@prisma/client';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import type { AuthUser } from '../types/request-user.type';
import { userHasRole } from '../types/request-user.type';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleCode[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) {
      return true;
    }
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Missing user context');
    }
    if (!userHasRole(user, ...required)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
