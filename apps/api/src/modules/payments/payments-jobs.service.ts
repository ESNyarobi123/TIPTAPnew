import { Injectable } from '@nestjs/common';
import type { PaymentTransaction } from '@prisma/client';
import { PaymentsDispatchService } from './payments-dispatch.service';
import { PaymentsService } from './payments.service';
import {
  type PaymentRefreshReason,
  type PaymentRefreshStatusJob,
  type PaymentWebhookUpdateJob,
} from './payments-queue.constants';

@Injectable()
export class PaymentsJobsService {
  constructor(
    private readonly payments: PaymentsService,
    private readonly dispatch: PaymentsDispatchService,
  ) {}

  async enqueueWebhookUpdateValidated(input: Omit<PaymentWebhookUpdateJob, 'receivedAt'>) {
    await this.payments.assertExternalPaymentUpdateAccepted(input);

    if (!this.dispatch.isQueueingEnabled()) {
      const updated = await this.payments.applyExternalPaymentUpdate(input);
      return {
        accepted: true,
        mode: 'inline',
        transactionId: updated.id,
        status: updated.status,
      };
    }

    const job = await this.dispatch.enqueueWebhookUpdate({
      ...input,
      receivedAt: new Date().toISOString(),
    });
    return {
      accepted: true,
      mode: 'queued',
      jobId: job?.id ?? null,
      orderReference: input.orderReference,
    };
  }

  async processWebhookUpdateJob(job: PaymentWebhookUpdateJob) {
    const updated = await this.payments.applyExternalPaymentUpdate(job);
    return {
      transactionId: updated.id,
      status: updated.status,
      requeued: false,
      nextAttempt: null,
      queuedJobId: null,
    };
  }

  async processRefreshStatusJob(job: PaymentRefreshStatusJob) {
    const updated = await this.payments.refreshTransactionStatusByIdInternal(job.transactionId);
    const nextAttempt = job.attempt + 1;
    const requeue = await this.queueFollowUpIfPending(updated, job.reason, nextAttempt, job.maxAttempts);
    return {
      transactionId: updated.id,
      status: updated.status,
      requeued: requeue.requeued,
      nextAttempt: requeue.nextAttempt,
      queuedJobId: requeue.jobId,
    };
  }

  private async queueFollowUpIfPending(
    txn: PaymentTransaction,
    reason: PaymentRefreshReason,
    attempt: number,
    maxAttempts: number,
  ) {
    if (!this.dispatch.isQueueingEnabled() || txn.status !== 'PENDING' || attempt > maxAttempts) {
      return { requeued: false, nextAttempt: null as number | null, jobId: null as string | null };
    }
    const queued = await this.dispatch.safeScheduleRefreshStatus({
      transactionId: txn.id,
      tenantId: txn.tenantId,
      reason,
      attempt,
      maxAttempts,
      requestedAt: new Date().toISOString(),
    });
    return {
      requeued: Boolean(queued?.id),
      nextAttempt: attempt,
      jobId: queued?.id ? String(queued.id) : null,
    };
  }
}
