import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { TenantsModule } from '../tenants/tenants.module';
import { StatementsController } from './statements.controller';
import { StatementsService } from './statements.service';

@Module({
  imports: [PrismaModule, TenantsModule, AnalyticsModule],
  controllers: [StatementsController],
  providers: [StatementsService],
})
export class StatementsModule {}
