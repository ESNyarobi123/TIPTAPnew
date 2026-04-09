export const PAYMENTS_QUEUE_NAME = 'payments-ops';

export const PAYMENTS_JOB_NAMES = {
  webhookUpdate: 'payments.webhook-update',
  refreshStatus: 'payments.refresh-status',
} as const;

export type PaymentRefreshReason =
  | 'ussd-init'
  | 'payout-init'
  | 'tip-init'
  | 'webhook-pending'
  | 'manual-followup';

export type PaymentWebhookUpdateJob = {
  tenantId: string;
  orderReference: string;
  providerStatus: string | null;
  externalRef?: string | null;
  rawPayload?: unknown;
  headerSecret?: string | null;
  receivedAt: string;
};

export type PaymentRefreshStatusJob = {
  transactionId: string;
  tenantId: string;
  reason: PaymentRefreshReason;
  attempt: number;
  maxAttempts: number;
  requestedAt: string;
};

export const PAYMENT_REFRESH_DELAYS_MS = [45_000, 120_000, 300_000, 900_000] as const;
