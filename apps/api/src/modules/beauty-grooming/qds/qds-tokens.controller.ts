import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthUser } from '../../auth/types/request-user.type';
import type { FoodDiningRequestMeta } from '../../food-dining/menu-categories/menu-categories.service';
import { BeautyGroomingAccessService } from '../beauty-grooming-access.service';
import { CreateQdsTokenDto } from './dto/create-qds-token.dto';
import { QdsService } from './qds.service';

function meta(req: Request): FoodDiningRequestMeta {
  return {
    correlationId: req.correlationId,
    ipAddress: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@ApiTags('beauty-grooming')
@ApiBearerAuth()
@Controller('beauty-grooming/qds/tokens')
@UseGuards(RolesGuard)
export class QdsTokensController {
  constructor(
    private readonly qds: QdsService,
    private readonly beautyAccess: BeautyGroomingAccessService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Create QDS token (raw token returned once)' })
  create(@Body() body: CreateQdsTokenDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.qds.createToken(user, body, meta(req));
  }

  @Get()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'List QDS tokens' })
  async list(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId: string | undefined,
    @Query('branchId') branchId: string | undefined,
  ) {
    const tid = await this.beautyAccess.resolveTenantId(user, tenantId);
    return this.qds.listTokens(user, tid, branchId);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Revoke QDS token' })
  revoke(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.qds.revokeToken(user, id, meta(req));
  }
}
