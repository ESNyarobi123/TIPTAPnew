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
import type { BeautyGroomingRequestMeta } from '../service-categories/service-categories.service';
import { CreateBeautyStationDto } from './dto/create-beauty-station.dto';
import { PatchBeautyStationDto } from './dto/patch-beauty-station.dto';
import { StationsService } from './stations.service';

function bgMeta(req: Request): BeautyGroomingRequestMeta {
  return {
    correlationId: req.correlationId,
    ipAddress: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@ApiTags('beauty-grooming')
@ApiBearerAuth()
@Controller('beauty-grooming/stations')
@UseGuards(RolesGuard)
export class StationsController {
  constructor(
    private readonly stations: StationsService,
    private readonly beautyAccess: BeautyGroomingAccessService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Create beauty station' })
  create(@Body() body: CreateBeautyStationDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.stations.create(user, body, bgMeta(req));
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
  @ApiOperation({ summary: 'List stations (tenantId query; optional branchId)' })
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId: string | undefined,
    @Query('branchId') branchId: string | undefined,
  ) {
    const tid = await this.beautyAccess.resolveTenantId(user, tenantId);
    return this.stations.findAll(user, tid, branchId);
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
  @ApiOperation({ summary: 'Get station by id' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.stations.findOne(user, id);
  }

  @Patch(':id')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Update station' })
  patch(
    @Param('id') id: string,
    @Body() body: PatchBeautyStationDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.stations.patch(user, id, body, bgMeta(req));
  }
}
