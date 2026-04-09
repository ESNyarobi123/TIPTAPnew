import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { AuditService } from './audit.service';

@Global()
@Module({
  imports: [PrismaModule, TenantsModule, AnalyticsModule],
  controllers: [AuditLogsController],
  providers: [AuditService, AuditLogsService],
  exports: [AuditService, AuditLogsService],
})
export class AuditLogsModule {}
