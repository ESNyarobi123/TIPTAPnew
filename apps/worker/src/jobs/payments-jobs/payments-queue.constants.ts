export const PAYMENTS_QUEUE_NAME = 'payments-ops';

export const PAYMENTS_JOB_NAMES = {
  webhookUpdate: 'payments.webhook-update',
  refreshStatus: 'payments.refresh-status',
} as const;
