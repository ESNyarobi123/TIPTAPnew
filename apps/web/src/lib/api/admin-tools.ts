import { apiFetch } from './client';

export function adminSendBotGatewayTestMessage(
  token: string,
  body: { to: string; text: string },
) {
  return apiFetch<{ ok: boolean }>(`/admin/bot-gateway/test-message`, {
    token,
    method: 'POST',
    json: body,
  });
}

export function paymentsTestProviderConfig(
  token: string,
  body: { tenantId: string },
) {
  return apiFetch<{ ok: boolean; note?: string; tokenPreview?: string }>(
    `/payments/provider-config/test`,
    { token, method: 'POST', json: body },
  );
}

