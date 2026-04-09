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
import { BranchesService, type BranchRequestMeta } from './branches.service';
import { CreateBranchNestedDto } from './dto/create-branch-nested.dto';

function branchMeta(req: Request): BranchRequestMeta {
  return {
    correlationId: req.correlationId,
    ipAddress: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@ApiTags('branches')
@ApiBearerAuth()
@Controller('tenants/:tenantId/branches')
@UseGuards(RolesGuard)
export class TenantBranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER)
  @ApiOperation({ summary: 'Create branch under tenant (tenant-scoped path)' })
  create(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateBranchNestedDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.branches.createForTenant(user, tenantId, body, branchMeta(req));
  }

  @Get()
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'List branches for tenant' })
  findAll(@Param('tenantId') tenantId: string, @CurrentUser() user: AuthUser) {
    return this.branches.findAllForTenant(user, tenantId);
  }
}
