import { apiFetch } from './client';
import { toQueryString } from './query';

export type QrType = 'BUSINESS_QR' | 'STAFF_QR' | 'TABLE_QR' | 'STATION_QR';
export type QrBranchSummary = { id: string; name: string; code: string } | null;
export type QrLinkedTarget =
  | { kind: 'BUSINESS'; label: string | null }
  | { kind: 'STAFF'; id: string; label: string; handle?: string | null; providerCode?: string | null }
  | { kind: 'TABLE'; id: string; label: string; code: string }
  | { kind: 'STATION'; id: string; label: string; code: string };
export type QrCustomerLaunch = {
  channel: 'WHATSAPP';
  prefillText: string;
  tokenFormatHint: string;
  instructions: string;
};
export type QrRecord = {
  id: string;
  tenantId: string;
  branchId?: string | null;
  type: QrType;
  status: string;
  publicRef: string;
  staffId?: string | null;
  diningTableId?: string | null;
  beautyStationId?: string | null;
  metadata?: unknown;
  expiresAt?: string | null;
  revokedAt?: string | null;
  scanCount?: number;
  lastScannedAt?: string | null;
  rotatedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  branch?: QrBranchSummary;
  linkedTarget?: QrLinkedTarget;
};
export type QrMutationResult = QrRecord & {
  rawToken?: string;
  customerLaunch?: QrCustomerLaunch;
};

export type CreateQrBody = {
  tenantId?: string;
  branchId?: string | null;
  type: QrType;
  staffId?: string | null;
  diningTableId?: string | null;
  beautyStationId?: string | null;
  metadata?: unknown;
  expiresAt?: string | null;
};

export function listQr(token: string, tenantId: string) {
  return apiFetch<QrRecord[]>(`/qr${toQueryString({ tenantId })}`, { token });
}

export function getQr(token: string, id: string) {
  return apiFetch<QrRecord>(`/qr/${encodeURIComponent(id)}`, { token });
}

export function createQr(token: string, body: CreateQrBody) {
  return apiFetch<QrMutationResult>('/qr', { method: 'POST', token, json: body });
}

export function revokeQr(token: string, id: string) {
  return apiFetch<QrRecord>(`/qr/${encodeURIComponent(id)}/revoke`, { method: 'POST', token });
}

export function rotateQr(token: string, id: string) {
  return apiFetch<QrMutationResult>(`/qr/${encodeURIComponent(id)}/rotate`, { method: 'POST', token });
}
