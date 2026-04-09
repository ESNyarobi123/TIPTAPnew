import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotGatewayAdminController } from './admin.controller';
import { WhatsappSessionStoreService } from './whatsapp-session-store.service';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [ConfigModule],
  controllers: [BotGatewayAdminController],
  providers: [WhatsappService, WhatsappSessionStoreService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
