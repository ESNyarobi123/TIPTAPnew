import { apiFetch } from './client';

export type MyCompensationRow = {
  id: string;
  tenantId: string;
  branchId: string | null;
  staffId: string;
  type: string;
  status: string;
  amountCents: number;
  currency: string;
  periodLabel: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  effectiveDate: string;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  tenantName: string;
  branchName: string | null;
  staffName: string;
};

export type MyCompensationsResponse = {
  total: number;
  items: MyCompensationRow[];
};

export function listMyCompensations(token: string) {
  return apiFetch<MyCompensationsResponse>('/staff/me/compensations', { token });
}
