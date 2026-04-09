import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService, type AuthRequestMeta } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ImpersonateDto } from './dto/impersonate.dto';
import type { AuthUser } from './types/request-user.type';

function requestMeta(req: Request): AuthRequestMeta {
  return {
    ipAddress: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    correlationId: req.correlationId,
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register (first user becomes SUPER_ADMIN bootstrap)' })
  register(@Body() body: RegisterDto, @Req() req: Request) {
    return this.auth.register(body, requestMeta(req));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() body: LoginDto, @Req() req: Request) {
    return this.auth.login(body, requestMeta(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  refresh(@Body() body: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(body.refreshToken, requestMeta(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke refresh token' })
  logout(@Body() body: LogoutDto, @Req() req: Request) {
    return this.auth.logout(body.refreshToken, requestMeta(req));
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all refresh tokens for current user' })
  logoutAll(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.auth.logoutAll(user.userId, requestMeta(req));
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user profile and role assignments' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @Post('impersonate')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Impersonate a user (SUPER_ADMIN)' })
  impersonate(@Body() body: ImpersonateDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.auth.impersonate(user, body.userId, requestMeta(req));
  }
}
