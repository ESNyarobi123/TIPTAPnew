import {
  Body,
  Controller,
  Delete,
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
import { DiningOrderStatus, RoleCode } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthUser } from '../../auth/types/request-user.type';
import { FoodDiningAccessService } from '../food-dining-access.service';
import type { FoodDiningRequestMeta } from '../menu-categories/menu-categories.service';
import { AddDiningOrderItemDto } from './dto/add-dining-order-item.dto';
import { CreateDiningOrderDto } from './dto/create-dining-order.dto';
import { PatchDiningOrderDto } from './dto/patch-dining-order.dto';
import { PatchDiningOrderItemDto } from './dto/patch-dining-order-item.dto';
import { DiningOrdersService } from './dining-orders.service';

function fdMeta(req: Request): FoodDiningRequestMeta {
  return {
    correlationId: req.correlationId,
    ipAddress: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@ApiTags('food-dining')
@ApiBearerAuth()
@Controller('food-dining/orders')
@UseGuards(RolesGuard)
export class DiningOrdersController {
  constructor(
    private readonly orders: DiningOrdersService,
    private readonly foodAccess: FoodDiningAccessService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Create dining order (staff)' })
  create(@Body() body: CreateDiningOrderDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.orders.create(user, body, fdMeta(req));
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
  @ApiOperation({ summary: 'List dining orders' })
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId: string | undefined,
    @Query('branchId') branchId: string | undefined,
    @Query('status') status: DiningOrderStatus | undefined,
    @Query('staffId') staffId: string | undefined,
  ) {
    const tid = await this.foodAccess.resolveTenantId(user, tenantId);
    return this.orders.findAll(user, tid, { branchId, status, staffId });
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
  @ApiOperation({ summary: 'Get dining order with items' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.findOne(user, id);
  }

  @Patch(':id')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Update order status / payment fields' })
  patch(
    @Param('id') id: string,
    @Body() body: PatchDiningOrderDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.orders.patch(user, id, body, fdMeta(req));
  }

  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Claim order (links staff profile on JWT user)' })
  claim(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.orders.claim(user, id, fdMeta(req));
  }

  @Post(':id/portal-token')
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({
    summary: 'Mint or rotate customer portal token (rawToken returned once; hash stored)',
  })
  mintPortalToken(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.orders.mintPortalToken(user, id, fdMeta(req));
  }

  @Delete(':id/portal-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Revoke customer portal token' })
  async revokePortalToken(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    await this.orders.revokePortalToken(user, id, fdMeta(req));
  }

  @Post(':id/items')
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Add line item to order' })
  addItem(
    @Param('id') id: string,
    @Body() body: AddDiningOrderItemDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.orders.addItem(user, id, body, fdMeta(req));
  }

  @Patch(':id/items/:itemId')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Update order line (qty / KDS status)' })
  patchItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: PatchDiningOrderItemDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.orders.patchItem(user, id, itemId, body, fdMeta(req));
  }

  @Delete(':id/items/:itemId')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Remove line item' })
  removeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.orders.removeItem(user, id, itemId, fdMeta(req));
  }
}
