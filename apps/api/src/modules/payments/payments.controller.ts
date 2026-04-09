import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentTransactionType, RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/request-user.type';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { UpsertPaymentProviderConfigDto } from './dto/upsert-payment-provider-config.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(RolesGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('provider-config')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER)
  @ApiOperation({ summary: 'Create or update ClickPesa config for a tenant (credentials encrypted)' })
  upsertProviderConfig(@Body() body: UpsertPaymentProviderConfigDto, @CurrentUser() user: AuthUser) {
    return this.payments.upsertProviderConfig(user, body);
  }

  @Post('provider-config/test')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Test provider credentials by generating a token (no charge)' })
  testProviderConfig(
    @Body() body: { tenantId: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.testProviderConfig(user, body.tenantId);
  }

  @Get('provider-config')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'List payment provider configs for tenant' })
  listProviderConfigs(@Query('tenantId') tenantId: string, @CurrentUser() user: AuthUser) {
    return this.payments.listProviderConfigs(user, tenantId);
  }

  @Get('provider-config/:id')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Get masked provider config' })
  getProviderConfig(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.payments.getProviderConfig(user, id);
  }

  @Post('collections')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'USSD collection: create transaction + preview + initiate' })
  createCollection(@Body() body: CreateCollectionDto, @CurrentUser() user: AuthUser) {
    return this.payments.createCollection(user, body);
  }

  @Post('payouts')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER)
  @ApiOperation({ summary: 'Create payout (preview + create)' })
  createPayout(@Body() body: CreatePayoutDto, @CurrentUser() user: AuthUser) {
    return this.payments.createPayout(user, body);
  }

  @Get('transactions')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'List payment transactions' })
  listTransactions(
    @Query('tenantId') tenantId: string,
    @Query('type') type: PaymentTransactionType | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.listTransactions(user, tenantId, type);
  }

  @Get('transactions/:id')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SUPPORT_AGENT,
  )
  getTransaction(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.payments.getTransaction(user, id);
  }

  @Post('transactions/:id/refresh-status')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Query provider for latest status (reconciliation)' })
  refreshStatus(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.payments.refreshTransactionStatus(user, id);
  }

  @Post('transactions/:id/initiate-ussd')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Run USSD preview+initiate for pending COLLECTION/TIP_DIGITAL row' })
  initiateUssd(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.payments.initiateUssdForTransaction(user, id);
  }
}
