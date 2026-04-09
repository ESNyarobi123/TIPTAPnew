import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../../modules/auth/types/request-user.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return req.user;
  },
);
