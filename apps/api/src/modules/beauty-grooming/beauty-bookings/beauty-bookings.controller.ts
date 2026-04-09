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
import { BeautyBookingStatus, RoleCode } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthUser } from '../../auth/types/request-user.type';
import type { FoodDiningRequestMeta } from '../../food-dining/menu-categories/menu-categories.service';
import { BeautyGroomingAccessService } from '../beauty-grooming-access.service';
import { AddBeautyBookingServiceDto } from './dto/add-beauty-booking-service.dto';
import { CreateBeautyBookingDto } from './dto/create-beauty-booking.dto';
import { PatchBeautyBookingDto } from './dto/patch-beauty-booking.dto';
import { PatchBeautyBookingServiceDto } from './dto/patch-beauty-booking-service.dto';
import { BeautyBookingsService } from './beauty-bookings.service';

function meta(req: Request): FoodDiningRequestMeta {
  return {
    correlationId: req.correlationId,
    ipAddress: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@ApiTags('beauty-grooming')
@ApiBearerAuth()
@Controller('beauty-grooming/bookings')
@UseGuards(RolesGuard)
export class BeautyBookingsController {
  constructor(
    private readonly bookings: BeautyBookingsService,
    private readonly beautyAccess: BeautyGroomingAccessService,
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
  @ApiOperation({ summary: 'Create booking (staff)' })
  create(@Body() body: CreateBeautyBookingDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.bookings.create(user, body, meta(req));
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
  @ApiOperation({ summary: 'List bookings' })
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId: string | undefined,
    @Query('branchId') branchId: string | undefined,
    @Query('status') status: BeautyBookingStatus | undefined,
    @Query('staffId') staffId: string | undefined,
    @Query('date') date: string | undefined,
  ) {
    const tid = await this.beautyAccess.resolveTenantId(user, tenantId);
    return this.bookings.findAll(user, tid, { branchId, status, staffId, date });
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
  @ApiOperation({ summary: 'Get booking with services' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.bookings.findOne(user, id);
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
  @ApiOperation({ summary: 'Update booking' })
  patch(
    @Param('id') id: string,
    @Body() body: PatchBeautyBookingDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.bookings.patch(user, id, body, meta(req));
  }

  @Post(':id/check-in')
  @HttpCode(HttpStatus.OK)
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Check in (BOOKED/CONFIRMED → CHECKED_IN)' })
  checkIn(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.bookings.checkIn(user, id, meta(req));
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
    return this.bookings.mintPortalToken(user, id, meta(req));
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
    await this.bookings.revokePortalToken(user, id, meta(req));
  }

  @Post(':id/services')
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Add service line to booking' })
  addService(
    @Param('id') id: string,
    @Body() body: AddBeautyBookingServiceDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.bookings.addService(user, id, body, meta(req));
  }

  @Patch(':id/services/:serviceId')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Update booked service line' })
  patchService(
    @Param('id') id: string,
    @Param('serviceId') serviceId: string,
    @Body() body: PatchBeautyBookingServiceDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.bookings.patchService(user, id, serviceId, body, meta(req));
  }
}
