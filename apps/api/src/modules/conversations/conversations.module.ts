import { Module } from '@nestjs/common';
import { BeautyGroomingModule } from '../beauty-grooming/beauty-grooming.module';
import { FoodDiningModule } from '../food-dining/food-dining.module';
import { QrModule } from '../qr/qr.module';
import { RatingsModule } from '../ratings/ratings.module';
import { TenantsModule } from '../tenants/tenants.module';
import { ConversationEngineService } from './conversation-engine.service';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { SessionService } from './session.service';

@Module({
  imports: [QrModule, TenantsModule, FoodDiningModule, BeautyGroomingModule, RatingsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, SessionService, ConversationEngineService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
