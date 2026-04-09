import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { RootHealthController } from './root-health.controller';

@Module({
  imports: [TerminusModule, PrismaModule],
  controllers: [RootHealthController],
})
export class HealthModule {}
