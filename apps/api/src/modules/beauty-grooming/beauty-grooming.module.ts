import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { QrModule } from '../qr/qr.module';
import { RatingsModule } from '../ratings/ratings.module';
import { TenantsModule } from '../tenants/tenants.module';
import { TipsModule } from '../tips/tips.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AssistanceRequestsController } from './assistance-requests/assistance-requests.controller';
import { AssistanceRequestsService } from './assistance-requests/assistance-requests.service';
import { BookingPortalPublicController } from './beauty-bookings/booking-portal-public.controller';
import { BeautyBookingsController } from './beauty-bookings/beauty-bookings.controller';
import { BeautyBookingsService } from './beauty-bookings/beauty-bookings.service';
import { BeautyGroomingAccessService } from './beauty-grooming-access.service';
import { QdsPublicController } from './qds/qds-public.controller';
import { QdsTokensController } from './qds/qds-tokens.controller';
import { QdsService } from './qds/qds.service';
import { BeautyGroomingAnalyticsService } from './beauty-grooming-analytics/beauty-grooming-analytics.service';
import { BeautyGroomingConversationEngine } from './beauty-grooming-conversation.engine';
import { ServiceCategoriesController } from './service-categories/service-categories.controller';
import { ServiceCategoriesService } from './service-categories/service-categories.service';
import { ServicesController } from './services/services.controller';
import { ServicesService } from './services/services.service';
import { SpecializationsController } from './specializations/specializations.controller';
import { SpecializationsService } from './specializations/specializations.service';
import { StationsController } from './stations/stations.controller';
import { StationsService } from './stations/stations.service';

@Module({
  imports: [TenantsModule, RatingsModule, QrModule, UploadsModule, PaymentsModule, TipsModule],
  controllers: [
    ServiceCategoriesController,
    ServicesController,
    StationsController,
    SpecializationsController,
    AssistanceRequestsController,
    BeautyBookingsController,
    QdsTokensController,
    QdsPublicController,
    BookingPortalPublicController,
  ],
  providers: [
    BeautyGroomingAccessService,
    ServiceCategoriesService,
    ServicesService,
    StationsService,
    SpecializationsService,
    AssistanceRequestsService,
    BeautyBookingsService,
    BeautyGroomingAnalyticsService,
    BeautyGroomingConversationEngine,
    QdsService,
  ],
  exports: [
    BeautyGroomingConversationEngine,
    BeautyBookingsService,
    AssistanceRequestsService,
    ServiceCategoriesService,
    ServicesService,
  ],
})
export class BeautyGroomingModule {}
