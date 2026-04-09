import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsModule } from '../analytics/analytics.module';
import { TenantsModule } from '../tenants/tenants.module';
import { ClickPesaApiClient } from './clickpesa/clickpesa-api.client';
import { ClickPesaWebhookController } from './clickpesa-webhook.controller';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { ProviderFactoryService } from './providers/provider-factory.service';
import { PaymentsDashboardController } from './payments-dashboard.controller';
import { PaymentsDashboardService } from './payments-dashboard.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [TenantsModule, ConfigModule, AnalyticsModule],
  controllers: [PaymentsController, PaymentsDashboardController, ClickPesaWebhookController],
  providers: [
    PaymentsService,
    PaymentsDashboardService,
    MockPaymentProvider,
    ProviderFactoryService,
    ClickPesaApiClient,
  ],
  exports: [PaymentsService, ClickPesaApiClient],
})
export class PaymentsModule {}
