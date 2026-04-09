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
import { AssistanceRequestStatus, RoleCode } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthUser } from '../../auth/types/request-user.type';
import { BeautyGroomingAccessService } from '../beauty-grooming-access.service';
import type { BeautyGroomingRequestMeta } from '../service-categories/service-categories.service';
import { AssistanceRequestsService } from './assistance-requests.service';
import { CreateAssistanceRequestDto } from './dto/create-assistance-request.dto';
import { PatchAssistanceRequestDto } from './dto/patch-assistance-request.dto';

function bgMeta(req: Request): BeautyGroomingRequestMeta {
  return {
    correlationId: req.correlationId,
    ipAddress: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@ApiTags('beauty-grooming')
@ApiBearerAuth()
@Controller('beauty-grooming/assistance-requests')
@UseGuards(RolesGuard)
export class AssistanceRequestsController {
  constructor(
    private readonly assistance: AssistanceRequestsService,
    private readonly beautyAccess: BeautyGroomingAccessService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Create assistance request' })
  create(@Body() body: CreateAssistanceRequestDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.assistance.create(user, body, bgMeta(req));
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
  @ApiOperation({ summary: 'List assistance requests (tenantId; optional branchId, status)' })
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId: string | undefined,
    @Query('branchId') branchId: string | undefined,
    @Query('status') status: string | undefined,
  ) {
    const tid = await this.beautyAccess.resolveTenantId(user, tenantId);
    const st =
      status && Object.values(AssistanceRequestStatus).includes(status as AssistanceRequestStatus)
        ? (status as AssistanceRequestStatus)
        : undefined;
    return this.assistance.findAll(user, tid, branchId, st);
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
  @ApiOperation({ summary: 'Get assistance request by id' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.assistance.findOne(user, id);
  }

  @Patch(':id')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Update assistance request' })
  patch(
    @Param('id') id: string,
    @Body() body: PatchAssistanceRequestDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.assistance.patch(user, id, body, bgMeta(req));
  }
}
