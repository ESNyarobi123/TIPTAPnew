import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { Worker } from 'bullmq';
import { PAYMENTS_JOB_NAMES, PAYMENTS_QUEUE_NAME } from './payments-queue.constants';

@Injectable()
export class PaymentsQueueWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(PaymentsQueueWorker.name);
  private worker: Worker | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.worker = new Worker(PAYMENTS_QUEUE_NAME, (job) => this.process(job), {
      connection: {
        host: this.config.get<string>('REDIS_HOST', 'localhost'),
        port: Number(this.config.get<string>('REDIS_PORT', '6379')),
        password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      },
      concurrency: Number(this.config.get<string>('PAYMENTS_WORKER_CONCURRENCY', '6')),
    });

    this.worker.on('ready', () => {
      this.log.log(`Payments worker listening on queue ${PAYMENTS_QUEUE_NAME}`);
    });
    this.worker.on('failed', (job, error) => {
      this.log.warn(
        `Payments job ${job?.name ?? 'unknown'} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }

  async onModuleDestroy() {
    await this.worker?.close().catch(() => undefined);
  }

  private apiBase() {
    return this.config
      .get<string>('API_INTERNAL_BASE_URL', 'http://localhost:3000/api/v1')
      .replace(/\/$/, '');
  }

  private internalKey() {
    const key = this.config.get<string>('INTERNAL_SERVICES_KEY', '').trim();
    if (!key) {
      throw new Error('INTERNAL_SERVICES_KEY is required for worker jobs');
    }
    return key;
  }

  private async process(job: Job) {
    switch (job.name) {
      case PAYMENTS_JOB_NAMES.webhookUpdate:
        return this.callInternal('/payments/internal/jobs/webhook-update', job.data);
      case PAYMENTS_JOB_NAMES.refreshStatus:
        return this.callInternal('/payments/internal/jobs/refresh-status', job.data);
      default:
        throw new Error(`Unsupported payments job: ${job.name}`);
    }
  }

  private async callInternal(path: string, payload: unknown) {
    const res = await fetch(`${this.apiBase()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-services-key': this.internalKey(),
      },
      body: JSON.stringify(payload),
    });
    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`Internal API ${path} failed: ${res.status} ${raw.slice(0, 300)}`);
    }
    if (!raw) {
      return { ok: true };
    }
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return { ok: true, raw };
    }
  }
}
