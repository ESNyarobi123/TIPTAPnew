import { Module } from '@nestjs/common';
import { TenantImageUploadService } from './tenant-image-upload.service';

@Module({
  providers: [TenantImageUploadService],
  exports: [TenantImageUploadService],
})
export class UploadsModule {}
