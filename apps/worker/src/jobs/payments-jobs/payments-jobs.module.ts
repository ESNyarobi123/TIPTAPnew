import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsQueueWorker } from './payments-queue.worker';

@Module({
  imports: [ConfigModule],
  providers: [PaymentsQueueWorker],
})
export class PaymentsJobsModule {}
