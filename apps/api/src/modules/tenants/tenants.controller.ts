import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BusinessCategory, RoleCode } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/request-user.type';
import { CreateSelfServeTenantDto } from './dto/create-self-serve-tenant.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { PatchTenantCategoryDto } from './dto/patch-tenant-category.dto';
import { UpsertTenantLandingDto } from './dto/upsert-tenant-landing.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpsertTenantCategoryDto } from './dto/upsert-tenant-category.dto';
import type { TenantRequestMeta } from './tenants.service';
import { TenantsService } from './tenants.service';

function tenantMeta(req: Request): TenantRequestMeta {
  return {
    correlationId: req.correlationId,
    ipAddress: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@ApiTags('tenants')
@ApiBearerAuth()
@Controller('tenants')
@UseGuards(RolesGuard)
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create tenant (SUPER_ADMIN)' })
  create(@Body() body: CreateTenantDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.tenants.create(user, body, tenantMeta(req));
  }

  @Post('self-serve')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a trial tenant + first branch for the authenticated business owner' })
  createSelfServe(@Body() body: CreateSelfServeTenantDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.tenants.createSelfServe(user, body, tenantMeta(req));
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
  @ApiOperation({ summary: 'List tenants visible to caller' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.tenants.findAll(user);
  }

  @Get(':id/categories')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'List category assignments for tenant' })
  listCategories(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tenants.listCategories(user, id);
  }

  @Post(':id/categories')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER)
  @ApiOperation({ summary: 'Create or replace category row (upsert)' })
  upsertCategory(
    @Param('id') id: string,
    @Body() body: UpsertTenantCategoryDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.tenants.upsertCategory(user, id, body, tenantMeta(req));
  }

  @Patch(':id/categories/:category')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER)
  @ApiOperation({ summary: 'Patch category enabled/settings' })
  patchCategory(
    @Param('id') id: string,
    @Param('category', new ParseEnumPipe(BusinessCategory)) category: BusinessCategory,
    @Body() body: PatchTenantCategoryDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.tenants.patchCategory(user, id, category, body, tenantMeta(req));
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
  @ApiOperation({ summary: 'Get tenant by id' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tenants.findOne(user, id);
  }

  @Patch(':id')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER)
  @ApiOperation({ summary: 'Update tenant' })
  update(
    @Param('id') id: string,
    @Body() body: UpdateTenantDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.tenants.update(user, id, body, tenantMeta(req));
  }

  @Get(':id/landing')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get landing page draft/settings for tenant' })
  getLanding(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tenants.getLanding(user, id);
  }

  @Post(':id/landing')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Upsert landing page draft/settings for tenant' })
  upsertLanding(
    @Param('id') id: string,
    @Body() body: UpsertTenantLandingDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.tenants.upsertLanding(user, id, body, tenantMeta(req));
  }

  @Get('landing/:slug/public')
  @Public()
  @ApiOperation({ summary: 'Public tenant landing page by slug (published only)' })
  getLandingPublic(@Param('slug') slug: string) {
    return this.tenants.getLandingPublic(slug);
  }
}
