/** Stored decrypted per-tenant (never log). */
export type ClickPesaCredentials = {
  clientId: string;
  apiKey: string;
  checksumKey?: string;
  webhookSecret?: string;
};

export type ClickPesaTokenResponse = {
  success?: boolean;
  /** Official API: JWT string; may include `Bearer ` prefix per docs. */
  token?: string;
  access_token?: string;
  data?: { token?: string; access_token?: string };
};
