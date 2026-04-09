import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { BotGatewayAdminService } from './bot-gateway-admin.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, BotGatewayAdminService],
})
export class AdminModule {}

