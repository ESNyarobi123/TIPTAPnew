import { apiFetch } from './client';

export type AdminMetrics = {
  period?: { start24h?: string; start7d?: string; end?: string };
  tenants?: {
    total?: number;
    byStatus?: Record<string, number>;
    topByVolume7d?: {
      tenantId?: string;
      name?: string;
      status?: string | null;
      branchCount?: number;
      staffCount?: number;
      paymentCount?: number;
      amountCents?: number;
    }[];
  };
  users?: { total?: number; rolesByCode?: Record<string, number> };
  staff?: { total?: number; providerProfiles?: number };
  branches?: { total?: number };
  categories?: { enabledByCode?: Record<string, number> };
  landingPages?: { published?: number };
  paymentConfigs?: { active?: number };
  payments?: {
    completed24h?: { count?: number; amountCents?: number };
    completed7d?: { count?: number; amountCents?: number };
    failed24h?: { count?: number };
  };
  tips?: { completed7d?: { count?: number; amountCents?: number } };
  qr?: { total?: number; active?: number; scanned24h?: number };
  conversations?: { sessions24h?: number; active24h?: number; messages24h?: number };
  audits?: { events24h?: number };
  commission?: { rate?: number; estimated24hCents?: number; estimated7dCents?: number };
};

export function adminMetrics(token: string) {
  return apiFetch<AdminMetrics>('/admin/metrics', { token });
}
