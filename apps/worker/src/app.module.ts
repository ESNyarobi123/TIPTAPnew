import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsJobsModule } from './jobs/payments-jobs/payments-jobs.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PaymentsJobsModule],
})
export class AppModule {}
