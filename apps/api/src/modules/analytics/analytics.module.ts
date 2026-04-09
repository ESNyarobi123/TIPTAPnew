import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsScopeService } from './analytics-scope.service';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [PrismaModule, TenantsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsScopeService, AnalyticsService],
  exports: [AnalyticsScopeService],
})
export class AnalyticsModule {}
