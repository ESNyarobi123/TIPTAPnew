import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/request-user.type';
import {
  ReconciliationQueryDto,
  ReconciliationTransactionsQueryDto,
} from './dto/reconciliation-query.dto';
import { ReconciliationService } from './reconciliation.service';

@ApiTags('reconciliation')
@ApiBearerAuth()
@Controller('reconciliation')
@UseGuards(RolesGuard)
export class ReconciliationController {
  constructor(private readonly reconciliation: ReconciliationService) {}

  @Get('overview')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({
    summary: 'Reconciliation summary for a scope and period',
    description:
      'Loads payment rows in the period and computes mismatch/stale counts in-process. ' +
      'For large tenants, prefer a future SQL-aggregated or cached implementation.',
  })
  overview(@CurrentUser() user: AuthUser, @Query() q: ReconciliationQueryDto) {
    return this.reconciliation.overview(user, q);
  }

  @Get('transactions')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Paginated transactions with optional mismatch filter' })
  transactions(@CurrentUser() user: AuthUser, @Query() q: ReconciliationTransactionsQueryDto) {
    return this.reconciliation.transactions(user, q);
  }

  @Get('exceptions')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Exception samples: stale pending, failed, status mismatch' })
  exceptions(@CurrentUser() user: AuthUser, @Query() q: ReconciliationQueryDto) {
    return this.reconciliation.exceptions(user, q);
  }
}
