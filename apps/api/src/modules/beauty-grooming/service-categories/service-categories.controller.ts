import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthUser } from '../../auth/types/request-user.type';
import { BeautyGroomingAccessService } from '../beauty-grooming-access.service';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { PatchServiceCategoryDto } from './dto/patch-service-category.dto';
import { ServiceCategoriesService, type BeautyGroomingRequestMeta } from './service-categories.service';

function bgMeta(req: Request): BeautyGroomingRequestMeta {
  return {
    correlationId: req.correlationId,
    ipAddress: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@ApiTags('beauty-grooming')
@ApiBearerAuth()
@Controller('beauty-grooming/service-categories')
@UseGuards(RolesGuard)
export class ServiceCategoriesController {
  constructor(
    private readonly categories: ServiceCategoriesService,
    private readonly beautyAccess: BeautyGroomingAccessService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Create beauty service category' })
  create(@Body() body: CreateServiceCategoryDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.categories.create(user, body, bgMeta(req));
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
  @ApiOperation({ summary: 'List service categories (tenantId query; optional branchId, activeOnly)' })
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId: string | undefined,
    @Query('branchId') branchId: string | undefined,
    @Query('activeOnly') activeOnly: string | undefined,
  ) {
    const tid = await this.beautyAccess.resolveTenantId(user, tenantId);
    return this.categories.findAll(user, tid, branchId, activeOnly === 'true' || activeOnly === '1');
  }

  @Get(':id')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Get service category by id' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.categories.findOne(user, id);
  }

  @Patch(':id')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Update service category' })
  patch(
    @Param('id') id: string,
    @Body() body: PatchServiceCategoryDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.categories.patch(user, id, body, bgMeta(req));
  }
}
