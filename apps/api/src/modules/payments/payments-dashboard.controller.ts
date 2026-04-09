import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/request-user.type';
import {
  PaymentsConfigHealthQueryDto,
  PaymentsDashboardQueryDto,
  PaymentsRecentTransactionsQueryDto,
} from './dto/payments-dashboard-query.dto';
import { PaymentsDashboardService } from './payments-dashboard.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments/dashboard')
@UseGuards(RolesGuard)
export class PaymentsDashboardController {
  constructor(private readonly dashboard: PaymentsDashboardService) {}

  @Get()
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Merchant payment dashboard summary' })
  summary(@CurrentUser() user: AuthUser, @Query() q: PaymentsDashboardQueryDto) {
    return this.dashboard.dashboardSummary(user, q.tenantId, q.branchId);
  }

  @Get('config-health')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Masked provider config health for a tenant' })
  configHealth(@CurrentUser() user: AuthUser, @Query() q: PaymentsConfigHealthQueryDto) {
    return this.dashboard.configHealth(user, q.tenantId, q.branchId);
  }

  @Get('recent-transactions')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Paginated recent payment transactions' })
  recent(@CurrentUser() user: AuthUser, @Query() q: PaymentsRecentTransactionsQueryDto) {
    return this.dashboard.recentTransactions(user, q);
  }

  @Get('reconciliation-flags')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Stale / failed / webhook heuristics' })
  flags(@CurrentUser() user: AuthUser, @Query() q: PaymentsDashboardQueryDto) {
    return this.dashboard.reconciliationFlags(user, q.tenantId, q.branchId);
  }
}
