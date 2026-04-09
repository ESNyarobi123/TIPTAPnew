import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotGatewayAdminController } from './admin.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [ConfigModule],
  controllers: [BotGatewayAdminController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
