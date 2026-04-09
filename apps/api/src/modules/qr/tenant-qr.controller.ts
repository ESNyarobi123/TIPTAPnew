import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/request-user.type';
import { CreateQrNestedDto } from './dto/create-qr-nested.dto';
import { QrService, type QrRequestMeta } from './qr.service';

function qrMeta(req: Request): QrRequestMeta {
  return {
    correlationId: req.correlationId,
    ipAddress: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@ApiTags('qr')
@ApiBearerAuth()
@Controller('tenants/:tenantId/qr')
@UseGuards(RolesGuard)
export class TenantQrController {
  constructor(private readonly qr: QrService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Create QR under tenant (tenant-scoped path)' })
  create(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateQrNestedDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.qr.createForTenant(user, tenantId, body, qrMeta(req));
  }

  @Get()
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'List QR codes for tenant' })
  findAll(@Param('tenantId') tenantId: string, @CurrentUser() user: AuthUser) {
    return this.qr.findAll(user, tenantId);
  }
}
