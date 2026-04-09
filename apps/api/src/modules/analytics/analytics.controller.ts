import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/request-user.type';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsPaymentsQueryDto,
  AnalyticsQueryDto,
  AnalyticsRatingsQueryDto,
  AnalyticsTipsQueryDto,
} from './dto/analytics-query.dto';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(RolesGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({
    summary: 'Cross-domain summary for the selected scope and period',
    description:
      'SUPER_ADMIN may omit tenantId for platform-wide aggregates (expensive full-table style queries). ' +
      'In production, prefer requiring tenantId, caching, or async exports.',
  })
  overview(@CurrentUser() user: AuthUser, @Query() q: AnalyticsQueryDto) {
    return this.analytics.overview(user, q);
  }

  @Get('payments')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Payment analytics (totals, breakdowns, volume over time)' })
  payments(@CurrentUser() user: AuthUser, @Query() q: AnalyticsPaymentsQueryDto) {
    return this.analytics.payments(user, q);
  }

  @Get('tips')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Tip analytics' })
  tips(@CurrentUser() user: AuthUser, @Query() q: AnalyticsTipsQueryDto) {
    return this.analytics.tips(user, q);
  }

  @Get('ratings')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Rating analytics' })
  ratings(@CurrentUser() user: AuthUser, @Query() q: AnalyticsRatingsQueryDto) {
    return this.analytics.ratings(user, q);
  }

  @Get('operations')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Waiter calls, bills, assistance, dining support' })
  operations(@CurrentUser() user: AuthUser, @Query() q: AnalyticsQueryDto) {
    return this.analytics.operations(user, q);
  }

  @Get('food-dining')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'FOOD_DINING category snapshot' })
  foodDining(@CurrentUser() user: AuthUser, @Query() q: AnalyticsQueryDto) {
    return this.analytics.foodDining(user, q);
  }

  @Get('beauty-grooming')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'BEAUTY_GROOMING category snapshot' })
  beautyGrooming(@CurrentUser() user: AuthUser, @Query() q: AnalyticsQueryDto) {
    return this.analytics.beautyGrooming(user, q);
  }
}
