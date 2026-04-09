import { apiFetch } from './client';

export function paymentsTestProviderConfig(token: string, body: { tenantId: string }) {
  return apiFetch<{ ok: boolean; note?: string; tokenPreview?: string }>(
    `/payments/provider-config/test`,
    { token, method: 'POST', json: body },
  );
}

