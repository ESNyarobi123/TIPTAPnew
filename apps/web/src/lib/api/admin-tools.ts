import { apiFetch } from './client';

export type BotGatewayStatus = {
  ok: boolean;
  baseUrl: string;
  gatewayReachable: boolean;
  adminKeyConfigured: boolean;
  service?: string;
  channel?: string;
  whatsappEnabled?: boolean;
  bootState?: string;
  connected?: boolean;
  connectionState?: string;
  canSend?: boolean;
  lastError?: string | null;
  note?: string;
};

export function adminGetBotGatewayStatus(token: string) {
  return apiFetch<BotGatewayStatus>(`/admin/bot-gateway/status`, {
    token,
  });
}

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
