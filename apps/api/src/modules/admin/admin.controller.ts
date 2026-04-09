import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  BeautyBookingStatus,
  DiningOrderStatus,
  PayrollLineKind,
  RoleCode,
  StaffCompensationStatus,
  StaffCompensationType,
  TenantStatus,
} from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/request-user.type';
import { AdminService } from './admin.service';
import { BotGatewayAdminService } from './bot-gateway-admin.service';
import {
  approvalRiskLevels,
  approvalWorkflowStates,
  type ApprovalRiskLevel,
  type ApprovalWorkflowState,
  UpdateTenantApprovalDto,
} from './dto/update-tenant-approval.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(RolesGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly botGateway: BotGatewayAdminService,
  ) {}

  @Get('metrics')
  @Roles(RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Platform command center metrics (SUPER_ADMIN)' })
  metrics(@CurrentUser() user: AuthUser) {
    return this.admin.metrics(user);
  }

  @Get('approvals')
  @Roles(RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Merchant approval queue with governance data (SUPER_ADMIN)' })
  listApprovals(
    @CurrentUser() user: AuthUser,
    @Query('q') q?: string,
    @Query('tenantStatus') tenantStatusRaw?: string,
    @Query('workflowStatus') workflowStatusRaw?: string,
    @Query('riskLevel') riskLevelRaw?: string,
  ) {
    const tenantStatus =
      tenantStatusRaw && (Object.values(TenantStatus) as string[]).includes(tenantStatusRaw)
        ? (tenantStatusRaw as TenantStatus)
        : undefined;
    const workflowStatus =
      workflowStatusRaw && (approvalWorkflowStates as readonly string[]).includes(workflowStatusRaw)
        ? (workflowStatusRaw as ApprovalWorkflowState)
        : undefined;
    const riskLevel =
      riskLevelRaw && (approvalRiskLevels as readonly string[]).includes(riskLevelRaw)
        ? (riskLevelRaw as ApprovalRiskLevel)
        : undefined;

    return this.admin.listApprovals(user, {
      search: q,
      tenantStatus,
      workflowStatus,
      riskLevel,
    });
  }

  @Patch('approvals/:tenantId')
  @Roles(RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Review / approve / reject merchant workspace onboarding (SUPER_ADMIN)' })
  patchApproval(
    @CurrentUser() user: AuthUser,
    @Param('tenantId') tenantId: string,
    @Body() body: UpdateTenantApprovalDto,
  ) {
    return this.admin.updateApproval(user, tenantId, body);
  }

  @Get('staff')
  @Roles(RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'List staff across all tenants (SUPER_ADMIN)' })
  listStaff(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
    @Query('q') q?: string,
    @Query('page', new DefaultValuePipe('1')) pageRaw?: string,
    @Query('pageSize', new DefaultValuePipe('25')) pageSizeRaw?: string,
  ) {
    const page = Math.max(1, parseInt(String(pageRaw ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(pageSizeRaw ?? '25'), 10) || 25));
    return this.admin.listStaff(user, { tenantId, search: q, page, pageSize });
  }

  @Get('dining-orders')
  @Roles(RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'List dining orders across tenants (SUPER_ADMIN)' })
  listDiningOrders(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
    @Query('branchId') branchId?: string,
    @Query('status') statusRaw?: string,
    @Query('q') q?: string,
    @Query('page', new DefaultValuePipe('1')) pageRaw?: string,
    @Query('pageSize', new DefaultValuePipe('25')) pageSizeRaw?: string,
  ) {
    const page = Math.max(1, parseInt(String(pageRaw ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(pageSizeRaw ?? '25'), 10) || 25));
    const status =
      statusRaw && (Object.values(DiningOrderStatus) as string[]).includes(statusRaw)
        ? (statusRaw as DiningOrderStatus)
        : undefined;
    return this.admin.listDiningOrders(user, {
      tenantId,
      branchId,
      status,
      search: q,
      page,
      pageSize,
    });
  }

  @Get('beauty-bookings')
  @Roles(RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'List beauty bookings across tenants (SUPER_ADMIN)' })
  listBeautyBookings(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
    @Query('branchId') branchId?: string,
    @Query('status') statusRaw?: string,
    @Query('q') q?: string,
    @Query('page', new DefaultValuePipe('1')) pageRaw?: string,
    @Query('pageSize', new DefaultValuePipe('25')) pageSizeRaw?: string,
  ) {
    const page = Math.max(1, parseInt(String(pageRaw ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(pageSizeRaw ?? '25'), 10) || 25));
    const status =
      statusRaw && (Object.values(BeautyBookingStatus) as string[]).includes(statusRaw)
        ? (statusRaw as BeautyBookingStatus)
        : undefined;
    return this.admin.listBeautyBookings(user, {
      tenantId,
      branchId,
      status,
      search: q,
      page,
      pageSize,
    });
  }

  @Get('compensations')
  @Roles(RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'List staff compensation rows across tenants (SUPER_ADMIN)' })
  listCompensations(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
    @Query('branchId') branchId?: string,
    @Query('status') statusRaw?: string,
    @Query('type') typeRaw?: string,
    @Query('lineKind') lineKindRaw?: string,
    @Query('q') q?: string,
    @Query('page', new DefaultValuePipe('1')) pageRaw?: string,
    @Query('pageSize', new DefaultValuePipe('25')) pageSizeRaw?: string,
  ) {
    const page = Math.max(1, parseInt(String(pageRaw ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(pageSizeRaw ?? '25'), 10) || 25));
    const status =
      statusRaw && (Object.values(StaffCompensationStatus) as string[]).includes(statusRaw)
        ? (statusRaw as StaffCompensationStatus)
        : undefined;
    const type =
      typeRaw && (Object.values(StaffCompensationType) as string[]).includes(typeRaw)
        ? (typeRaw as StaffCompensationType)
        : undefined;
    const lineKind =
      lineKindRaw && (Object.values(PayrollLineKind) as string[]).includes(lineKindRaw)
        ? (lineKindRaw as PayrollLineKind)
        : undefined;
    return this.admin.listCompensations(user, {
      tenantId,
      branchId,
      status,
      type,
      lineKind,
      search: q,
      page,
      pageSize,
    });
  }

  @Get('order-center')
  @Roles(RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Unified commercial order center across dining, beauty, and orphan ledger rows (SUPER_ADMIN)' })
  orderCenter(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
    @Query('branchId') branchId?: string,
    @Query('kind') kind?: string,
    @Query('workflowStatus') workflowStatus?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('commercialStatus') commercialStatus?: string,
    @Query('q') q?: string,
    @Query('page', new DefaultValuePipe('1')) pageRaw?: string,
    @Query('pageSize', new DefaultValuePipe('25')) pageSizeRaw?: string,
  ) {
    const page = Math.max(1, parseInt(String(pageRaw ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(pageSizeRaw ?? '25'), 10) || 25));
    return this.admin.getOrderCenter(user, {
      tenantId,
      branchId,
      kind,
      workflowStatus,
      paymentStatus,
      commercialStatus,
      search: q,
      page,
      pageSize,
    });
  }

  @Post('bot-gateway/test-message')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Send a WhatsApp test message via bot-gateway (SUPER_ADMIN)' })
  sendTestMessage(
    @Body() body: { to: string; text: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.botGateway.sendTestWhatsappMessage(user, body.to, body.text);
  }

  @Get('bot-gateway/status')
  @Roles(RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Bot gateway health and WhatsApp connection status (SUPER_ADMIN)' })
  botGatewayStatus(@CurrentUser() user: AuthUser) {
    return this.botGateway.getStatus(user);
  }
}
