import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { QrModule } from '../qr/qr.module';
import { RatingsModule } from '../ratings/ratings.module';
import { TenantsModule } from '../tenants/tenants.module';
import { TipsModule } from '../tips/tips.module';
import { UploadsModule } from '../uploads/uploads.module';
import { BillRequestsController } from './bill-requests/bill-requests.controller';
import { BillRequestsService } from './bill-requests/bill-requests.service';
import { DiningOrdersController } from './dining-orders/dining-orders.controller';
import { DiningOrdersService } from './dining-orders/dining-orders.service';
import { DiningSupportRequestsService } from './dining-support/dining-support-requests.service';
import { FoodDiningAccessService } from './food-dining-access.service';
import { FoodDiningAnalyticsService } from './food-dining-analytics/food-dining-analytics.service';
import { FoodDiningConversationEngine } from './food-dining-conversation.engine';
import { MenuCategoriesController } from './menu-categories/menu-categories.controller';
import { MenuCategoriesService } from './menu-categories/menu-categories.service';
import { MenuItemsController } from './menu-items/menu-items.controller';
import { MenuItemsService } from './menu-items/menu-items.service';
import { TablesController } from './tables/tables.controller';
import { TablesService } from './tables/tables.service';
import { WaiterCallsController } from './waiter-calls/waiter-calls.controller';
import { WaiterCallsService } from './waiter-calls/waiter-calls.service';
import { KdsPublicController } from './kds/kds-public.controller';
import { KdsTokensController } from './kds/kds-tokens.controller';
import { KdsService } from './kds/kds.service';
import { OrderPortalPublicController } from './dining-orders/order-portal-public.controller';

@Module({
  imports: [TenantsModule, RatingsModule, QrModule, UploadsModule, PaymentsModule, TipsModule],
  controllers: [
    MenuCategoriesController,
    MenuItemsController,
    TablesController,
    WaiterCallsController,
    BillRequestsController,
    DiningOrdersController,
    KdsTokensController,
    KdsPublicController,
    OrderPortalPublicController,
  ],
  providers: [
    FoodDiningAccessService,
    MenuCategoriesService,
    MenuItemsService,
    TablesService,
    WaiterCallsService,
    BillRequestsService,
    DiningOrdersService,
    DiningSupportRequestsService,
    FoodDiningAnalyticsService,
    FoodDiningConversationEngine,
    KdsService,
  ],
  exports: [
    FoodDiningConversationEngine,
    DiningOrdersService,
    WaiterCallsService,
    BillRequestsService,
    DiningSupportRequestsService,
    MenuCategoriesService,
    MenuItemsService,
  ],
})
export class FoodDiningModule {}
