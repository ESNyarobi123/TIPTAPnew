import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthUser } from '../../auth/types/request-user.type';
import { FoodDiningAccessService } from '../food-dining-access.service';
import type { FoodDiningRequestMeta } from '../menu-categories/menu-categories.service';
import { CreateKdsTokenDto } from './dto/create-kds-token.dto';
import { KdsService } from './kds.service';

function fdMeta(req: Request): FoodDiningRequestMeta {
  return {
    correlationId: req.correlationId,
    ipAddress: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@ApiTags('food-dining')
@ApiBearerAuth()
@Controller('food-dining/kds/tokens')
@UseGuards(RolesGuard)
export class KdsTokensController {
  constructor(
    private readonly kds: KdsService,
    private readonly foodAccess: FoodDiningAccessService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Create KDS token (raw token returned once)' })
  create(@Body() body: CreateKdsTokenDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.kds.createToken(user, body, fdMeta(req));
  }

  @Get()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'List KDS tokens for tenant/branch' })
  async list(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId: string | undefined,
    @Query('branchId') branchId: string | undefined,
  ) {
    const tid = await this.foodAccess.resolveTenantId(user, tenantId);
    return this.kds.listTokens(user, tid, branchId);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Revoke KDS token' })
  revoke(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.kds.revokeToken(user, id, fdMeta(req));
  }
}
