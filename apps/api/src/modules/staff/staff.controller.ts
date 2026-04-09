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
import { RoleCode } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/request-user.type';
import { CreateStaffAssignmentDto } from './dto/create-staff-assignment.dto';
import { CreateStaffCompensationDto } from './dto/create-staff-compensation.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { CreateStaffJoinInviteDto } from './dto/create-staff-join-invite.dto';
import { BulkCreateStaffDto } from './dto/bulk-create-staff.dto';
import { LinkProviderProfileDto } from './dto/link-provider-profile.dto';
import { RedeemStaffJoinInviteDto } from './dto/redeem-staff-join-invite.dto';
import { SearchStaffQueryDto } from './dto/search-staff-query.dto';
import { UpdateStaffAssignmentDto } from './dto/update-staff-assignment.dto';
import { UpdateStaffCompensationDto } from './dto/update-staff-compensation.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffService, type StaffRequestMeta } from './staff.service';

function staffMeta(req: Request): StaffRequestMeta {
  return {
    correlationId: req.correlationId,
    ipAddress: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@ApiTags('staff')
@ApiBearerAuth()
@Controller('staff')
@UseGuards(RolesGuard)
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
  )
  @ApiOperation({ summary: 'Create staff member' })
  create(@Body() body: CreateStaffDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.staff.create(user, body, staffMeta(req));
  }

  @Post('bulk-create')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Bulk create staff from pasted lines and auto-link to branch' })
  bulkCreate(@Body() body: BulkCreateStaffDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.staff.bulkCreateAndLink(user, body, staffMeta(req));
  }

  @Post('link-provider-profile')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Create or link staff from a global provider code, then assign to branch' })
  linkProviderProfile(
    @Body() body: LinkProviderProfileDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.staff.linkProviderProfile(user, body, staffMeta(req));
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
  @ApiOperation({ summary: 'List staff for tenant (tenantId query required)' })
  findAll(@CurrentUser() user: AuthUser, @Query('tenantId') tenantId: string) {
    return this.staff.findAll(user, tenantId);
  }

  @Get('search')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Search staff within tenant (tenantId + q required)' })
  search(@CurrentUser() user: AuthUser, @Query() query: SearchStaffQueryDto) {
    return this.staff.search(user, String(query.tenantId ?? ''), String(query.q ?? ''));
  }

  @Get('me/workspace')
  @ApiOperation({ summary: 'Provider/staff personal workspace summary' })
  myWorkspace(@CurrentUser() user: AuthUser) {
    return this.staff.getMyWorkspace(user);
  }

  @Get('me/compensations')
  @ApiOperation({ summary: 'List compensation rows for my staff profile(s)' })
  myCompensations(@CurrentUser() user: AuthUser) {
    return this.staff.listMyCompensations(user);
  }

  @Post('join-invites/redeem')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redeem a join code to link your provider profile to a tenant branch' })
  redeemJoinInvite(
    @Body() body: RedeemStaffJoinInviteDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.staff.redeemJoinInvite(user, body, staffMeta(req));
  }

  @Post('join-invites')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Create a staff/provider join code for a branch' })
  createJoinInvite(
    @Body() body: CreateStaffJoinInviteDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.staff.createJoinInvite(user, body, staffMeta(req));
  }

  @Get('join-invites')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'List join codes for a tenant' })
  listJoinInvites(@CurrentUser() user: AuthUser, @Query('tenantId') tenantId: string) {
    return this.staff.listJoinInvites(user, tenantId);
  }

  @Patch('join-invites/:id/revoke')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Revoke a join code' })
  revokeJoinInvite(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.staff.revokeJoinInvite(user, id, staffMeta(req));
  }

  @Get(':id/assignments')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'List staff assignments' })
  listAssignments(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.staff.listAssignments(user, id);
  }

  @Get(':id/compensation')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'List staff compensation rows' })
  listCompensations(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.staff.listCompensations(user, id);
  }

  @Post(':id/assignments')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Assign staff to branch' })
  createAssignment(
    @Param('id') id: string,
    @Body() body: CreateStaffAssignmentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.staff.createAssignment(user, id, body, staffMeta(req));
  }

  @Post(':id/compensation')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Create salary / compensation row for staff' })
  createCompensation(
    @Param('id') id: string,
    @Body() body: CreateStaffCompensationDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.staff.createCompensation(user, id, body, staffMeta(req));
  }

  @Patch(':id/assignments/:assignmentId')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Update assignment (end / status)' })
  updateAssignment(
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @Body() body: UpdateStaffAssignmentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.staff.updateAssignment(user, id, assignmentId, body, staffMeta(req));
  }

  @Patch(':id/compensation/:compensationId')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Update staff compensation row' })
  updateCompensation(
    @Param('id') id: string,
    @Param('compensationId') compensationId: string,
    @Body() body: UpdateStaffCompensationDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.staff.updateCompensation(user, id, compensationId, body, staffMeta(req));
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Deactivate staff (status INACTIVE)' })
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.staff.deactivate(user, id, staffMeta(req));
  }

  @Delete(':id')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Soft-delete staff and end any active assignments' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.staff.remove(user, id, staffMeta(req));
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
  @ApiOperation({ summary: 'Get staff by id' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.staff.findOne(user, id);
  }

  @Get(':id/internal')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get internal staff profile (private notes)' })
  findOneInternal(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.staff.findOneInternal(user, id);
  }

  @Patch(':id/internal')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Update internal staff profile fields' })
  updateInternal(
    @Param('id') id: string,
    @Body() body: UpdateStaffDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.staff.update(user, id, body, staffMeta(req));
  }

  @Patch(':id')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Update staff' })
  update(
    @Param('id') id: string,
    @Body() body: UpdateStaffDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.staff.update(user, id, body, staffMeta(req));
  }
}
