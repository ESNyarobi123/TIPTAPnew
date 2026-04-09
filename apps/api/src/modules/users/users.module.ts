import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit-logs/audit.service';
import { TenantAccessService } from '../tenants/tenant-access.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PrismaService, TenantAccessService, AuditService],
  exports: [UsersService],
})
export class UsersModule {}
