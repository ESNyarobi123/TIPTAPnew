import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClickPesaCredentials, ClickPesaTokenResponse } from './clickpesa.types';

/**
 * HTTP client for ClickPesa third-parties API.
 * Base URL: https://api.clickpesa.com/third-parties (override with CLICKPESA_API_BASE_URL).
 * Paths follow public docs; adjust if your merchant dashboard differs.
 */
@Injectable()
export class ClickPesaApiClient {
  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    return (
      this.config.get<string>('clickpesa.apiBaseUrl')?.replace(/\/$/, '') ??
      'https://api.clickpesa.com/third-parties'
    );
  }

  /** Optional payload checksum when merchant enables it (MD5 of sorted key=value + checksumKey). */
  createChecksum(payload: Record<string, string>, checksumKey: string): string {
    const sorted = Object.keys(payload)
      .sort()
      .map((k) => `${k}=${payload[k]}`)
      .join('&');
    return createHash('md5').update(`${sorted}${checksumKey}`).digest('hex');
  }

  /**
   * Official third-parties flow: POST /generate-token with headers `client-id` and `api-key`
   * (see https://docs.clickpesa.com/api-reference/authorization/generate-token).
   * Legacy JSON body `/auth/login` is not used.
   */
  async generateToken(creds: ClickPesaCredentials): Promise<string> {
    const url = `${this.baseUrl()}/generate-token`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'client-id': creds.clientId,
        'api-key': creds.apiKey,
      },
    });
    const text = await res.text();
    let json: ClickPesaTokenResponse & Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as ClickPesaTokenResponse & Record<string, unknown>;
    } catch {
      throw new Error(`ClickPesa token: non-JSON response (${res.status}): ${text.slice(0, 200)}`);
    }
    if (!res.ok) {
      throw new Error(`ClickPesa token failed: ${res.status} ${text.slice(0, 300)}`);
    }
    const raw =
      json.token ??
      json.access_token ??
      (typeof json.data === 'object' && json.data && 'token' in json.data
        ? (json.data as { token?: string }).token
        : undefined);
    if (!raw || typeof raw !== 'string') {
      throw new Error('ClickPesa token: missing token in response');
    }
    const trimmed = raw.trim();
    return trimmed.startsWith('Bearer ') ? trimmed.slice('Bearer '.length).trim() : trimmed;
  }

  async previewUssdPush(
    bearerToken: string,
    body: { amount: string; orderReference: string; phoneNumber: string; currency: string; checksum?: string },
  ): Promise<unknown> {
    const url = `${this.baseUrl()}/payments/preview-ussd-push-request`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`ClickPesa preview USSD failed: ${res.status} ${JSON.stringify(data).slice(0, 400)}`);
    }
    return data;
  }

  async initiateUssdPush(
    bearerToken: string,
    body: { amount: string; orderReference: string; phoneNumber: string; currency: string; checksum?: string },
  ): Promise<unknown> {
    const url = `${this.baseUrl()}/payments/initiate-ussd-push-request`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`ClickPesa initiate USSD failed: ${res.status} ${JSON.stringify(data).slice(0, 400)}`);
    }
    return data;
  }

  async queryPaymentByOrderReference(bearerToken: string, orderReference: string): Promise<unknown> {
    const url = `${this.baseUrl()}/payments/query-payment-status?orderReference=${encodeURIComponent(orderReference)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${bearerToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`ClickPesa query payment failed: ${res.status} ${JSON.stringify(data).slice(0, 400)}`);
    }
    return data;
  }

  async queryAllPayments(bearerToken: string, query: Record<string, string> = {}): Promise<unknown> {
    const q = new URLSearchParams(query).toString();
    const url = `${this.baseUrl()}/payments/query-all-payments${q ? `?${q}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${bearerToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`ClickPesa query all payments failed: ${res.status}`);
    }
    return data;
  }

  async previewPayout(bearerToken: string, body: Record<string, unknown>): Promise<unknown> {
    const url = `${this.baseUrl()}/payouts/preview-payout`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`ClickPesa preview payout failed: ${res.status}`);
    }
    return data;
  }

  async createPayout(bearerToken: string, body: Record<string, unknown>): Promise<unknown> {
    const url = `${this.baseUrl()}/payouts/create-payout`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`ClickPesa create payout failed: ${res.status}`);
    }
    return data;
  }

  async queryPayoutByOrderReference(bearerToken: string, orderReference: string): Promise<unknown> {
    const url = `${this.baseUrl()}/payouts/query-payout-status?orderReference=${encodeURIComponent(orderReference)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${bearerToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`ClickPesa query payout failed: ${res.status}`);
    }
    return data;
  }

  async queryAllPayouts(bearerToken: string, query: Record<string, string> = {}): Promise<unknown> {
    const q = new URLSearchParams(query).toString();
    const url = `${this.baseUrl()}/payouts/query-all-payouts${q ? `?${q}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${bearerToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`ClickPesa query all payouts failed: ${res.status}`);
    }
    return data;
  }
}
