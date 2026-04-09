import { Module } from '@nestjs/common';
import { ProviderRegistryModule } from '../provider-registry/provider-registry.module';
import { TenantsModule } from '../tenants/tenants.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  imports: [TenantsModule, ProviderRegistryModule],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
