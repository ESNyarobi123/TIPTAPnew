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
import { BillRequestStatus, RoleCode } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthUser } from '../../auth/types/request-user.type';
import { FoodDiningAccessService } from '../food-dining-access.service';
import type { FoodDiningRequestMeta } from '../menu-categories/menu-categories.service';
import { CreateBillRequestDto } from './dto/create-bill-request.dto';
import { PatchBillRequestDto } from './dto/patch-bill-request.dto';
import { BillRequestsService } from './bill-requests.service';

function fdMeta(req: Request): FoodDiningRequestMeta {
  return {
    correlationId: req.correlationId,
    ipAddress: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@ApiTags('food-dining')
@ApiBearerAuth()
@Controller('food-dining/bill-requests')
@UseGuards(RolesGuard)
export class BillRequestsController {
  constructor(
    private readonly bills: BillRequestsService,
    private readonly foodAccess: FoodDiningAccessService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Create bill request (staff / manual)' })
  create(@Body() body: CreateBillRequestDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.bills.create(user, body, fdMeta(req));
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
  @ApiOperation({ summary: 'List bill requests' })
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId: string | undefined,
    @Query('branchId') branchId: string | undefined,
    @Query('status') status: BillRequestStatus | undefined,
  ) {
    const tid = await this.foodAccess.resolveTenantId(user, tenantId);
    return this.bills.findAll(user, tid, branchId, status);
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
  @ApiOperation({ summary: 'Get bill request by id' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.bills.findOne(user, id);
  }

  @Patch(':id')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Update bill request status' })
  patch(
    @Param('id') id: string,
    @Body() body: PatchBillRequestDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.bills.patch(user, id, body, fdMeta(req));
  }
}
