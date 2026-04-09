import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  PAYMENT_REFRESH_DELAYS_MS,
  PAYMENTS_JOB_NAMES,
  PAYMENTS_QUEUE_NAME,
  type PaymentRefreshStatusJob,
  type PaymentWebhookUpdateJob,
} from './payments-queue.constants';

@Injectable()
export class PaymentsDispatchService implements OnModuleDestroy {
  private readonly log = new Logger(PaymentsDispatchService.name);
  private queue: Queue | null = null;

  constructor(private readonly config: ConfigService) {}

  isQueueingEnabled(): boolean {
    return this.config.get<string>('app.env') !== 'test';
  }

  async onModuleDestroy() {
    await this.queue?.close().catch(() => undefined);
  }

  private connection() {
    return {
      host: this.config.get<string>('redis.host'),
      port: this.config.get<number>('redis.port'),
      password: this.config.get<string>('redis.password') || undefined,
    };
  }

  private getQueue(): Queue | null {
    if (!this.isQueueingEnabled()) {
      return null;
    }
    if (!this.queue) {
      this.queue = new Queue(PAYMENTS_QUEUE_NAME, {
        connection: this.connection(),
        defaultJobOptions: {
          removeOnComplete: { count: 200 },
          removeOnFail: { count: 500 },
        },
      });
    }
    return this.queue;
  }

  async enqueueWebhookUpdate(data: PaymentWebhookUpdateJob) {
    const queue = this.getQueue();
    if (!queue) {
      return null;
    }
    return queue.add(PAYMENTS_JOB_NAMES.webhookUpdate, data, {
      attempts: 6,
      backoff: {
        type: 'exponential',
        delay: 15_000,
      },
      jobId: `payment:webhook:${data.tenantId}:${data.orderReference}:${Date.now()}`,
    });
  }

  async enqueueRefreshStatus(data: PaymentRefreshStatusJob, delayMs?: number) {
    const queue = this.getQueue();
    if (!queue) {
      return null;
    }
    const jobId = `payment:refresh:${data.transactionId}:attempt:${data.attempt}`;
    const existing = await queue.getJob(jobId);
    if (existing) {
      return existing;
    }
    const computedDelay =
      delayMs ??
      PAYMENT_REFRESH_DELAYS_MS[Math.min(data.attempt, PAYMENT_REFRESH_DELAYS_MS.length - 1)];
    return queue.add(PAYMENTS_JOB_NAMES.refreshStatus, data, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 30_000,
      },
      delay: computedDelay,
      jobId,
    });
  }

  async safeScheduleRefreshStatus(data: PaymentRefreshStatusJob, delayMs?: number) {
    try {
      return await this.enqueueRefreshStatus(data, delayMs);
    } catch (error) {
      this.log.warn(
        `Could not enqueue payment refresh for ${data.transactionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}
