import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import type { Request } from 'express';
import { PublicAbuseThrottle } from '../../common/decorators/public-abuse-throttle.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/request-user.type';
import { ResolveQrDto } from './dto/resolve-qr.dto';
import { CreateQrDto } from './dto/create-qr.dto';
import { QrResolverService } from './qr-resolver.service';
import { QrService, type QrRequestMeta } from './qr.service';

function qrMeta(req: Request): QrRequestMeta {
  return {
    correlationId: req.correlationId,
    ipAddress: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@ApiTags('qr')
@Controller('qr')
@UseGuards(RolesGuard)
export class QrController {
  constructor(
    private readonly qr: QrService,
    private readonly resolver: QrResolverService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Create QR (returns rawToken once)' })
  create(@Body() body: CreateQrDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.qr.create(user, body, qrMeta(req));
  }

  @Post('resolve')
  @Public()
  @PublicAbuseThrottle(45, 60_000)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve opaque QR secret (public)' })
  async resolve(@Body() body: ResolveQrDto) {
    const result = await this.resolver.resolveSecretToken(body.token);
    if (!result.ok) {
      throw new NotFoundException('QR could not be resolved');
    }
    return { valid: true, context: result.context };
  }

  @Get()
  @ApiBearerAuth()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER, RoleCode.SUPPORT_AGENT)
  @ApiOperation({ summary: 'List QR codes for tenant' })
  findAll(@CurrentUser() user: AuthUser, @Query('tenantId') tenantId: string) {
    return this.qr.findAll(user, tenantId);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Revoke QR' })
  revoke(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.qr.revoke(user, id, qrMeta(req));
  }

  @Post(':id/rotate')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Rotate QR secret (invalidates previous token)' })
  rotate(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.qr.rotate(user, id, qrMeta(req));
  }

  @Get(':id')
  @ApiBearerAuth()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER, RoleCode.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Get QR metadata' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.qr.findOne(user, id);
  }
}
