import { Module } from '@nestjs/common';
import { TenantAccessService } from './tenant-access.service';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, TenantAccessService],
  exports: [TenantsService, TenantAccessService],
})
export class TenantsModule {}
