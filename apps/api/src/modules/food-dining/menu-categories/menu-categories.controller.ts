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
import { FoodDiningAccessService } from '../food-dining-access.service';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { PatchMenuCategoryDto } from './dto/patch-menu-category.dto';
import { MenuCategoriesService, type FoodDiningRequestMeta } from './menu-categories.service';

function fdMeta(req: Request): FoodDiningRequestMeta {
  return {
    correlationId: req.correlationId,
    ipAddress: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@ApiTags('food-dining')
@ApiBearerAuth()
@Controller('food-dining/menu-categories')
@UseGuards(RolesGuard)
export class MenuCategoriesController {
  constructor(
    private readonly categories: MenuCategoriesService,
    private readonly foodAccess: FoodDiningAccessService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Create dining menu category' })
  create(@Body() body: CreateMenuCategoryDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.categories.create(user, body, fdMeta(req));
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
  @ApiOperation({ summary: 'List menu categories (tenantId query; optional branchId, activeOnly)' })
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId: string | undefined,
    @Query('branchId') branchId: string | undefined,
    @Query('activeOnly') activeOnly: string | undefined,
  ) {
    const tid = await this.foodAccess.resolveTenantId(user, tenantId);
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
  @ApiOperation({ summary: 'Get menu category by id' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.categories.findOne(user, id);
  }

  @Patch(':id')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Update menu category' })
  patch(
    @Param('id') id: string,
    @Body() body: PatchMenuCategoryDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.categories.patch(user, id, body, fdMeta(req));
  }
}
