import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { PublicBranchesController } from './public-branches.controller';
import { TenantBranchesController } from './tenant-branches.controller';

@Module({
  imports: [TenantsModule],
  controllers: [BranchesController, TenantBranchesController, PublicBranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
