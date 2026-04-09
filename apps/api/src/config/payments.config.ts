import { registerAs } from '@nestjs/config';

export default registerAs('payments', () => ({
  credentialsSecret: process.env.PAYMENTS_CREDENTIALS_SECRET ?? '',
  stalePendingHours: Number(process.env.PAYMENTS_STALE_PENDING_HOURS ?? 48),
  webhookStaleHours: Number(process.env.PAYMENTS_WEBHOOK_STALE_HOURS ?? 72),
}));

export const clickpesaConfig = registerAs('clickpesa', () => ({
  apiBaseUrl: process.env.CLICKPESA_API_BASE_URL ?? 'https://api.clickpesa.com/third-parties',
}));
