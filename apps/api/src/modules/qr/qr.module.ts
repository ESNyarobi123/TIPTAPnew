import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { QrController } from './qr.controller';
import { QrResolverService } from './qr-resolver.service';
import { QrService } from './qr.service';
import { QrTokenService } from './qr-token.service';
import { TenantQrController } from './tenant-qr.controller';

@Module({
  imports: [TenantsModule],
  controllers: [QrController, TenantQrController],
  providers: [QrService, QrTokenService, QrResolverService],
  exports: [QrService, QrResolverService, QrTokenService],
})
export class QrModule {}
