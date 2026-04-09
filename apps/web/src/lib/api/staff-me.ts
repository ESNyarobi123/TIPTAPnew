import { apiFetch } from './client';
import type { PayrollLineKind, PayrollSlipRecord } from './staff';

export type MyCompensationRow = {
  id: string;
  tenantId: string;
  branchId: string | null;
  staffId: string;
  type: string;
  status: string;
  lineKind?: PayrollLineKind | null;
  label?: string | null;
  sourceReference?: string | null;
  amountCents: number;
  currency: string;
  periodLabel: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  effectiveDate: string;
  paidAt: string | null;
  notes: string | null;
  payrollRunId?: string | null;
  payrollSlipId?: string | null;
  lockedAt?: string | null;
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

export type MyPayslipsResponse = {
  total: number;
  items: PayrollSlipRecord[];
};

export function listMyPayslips(token: string) {
  return apiFetch<MyPayslipsResponse>('/staff/me/payslips', { token });
}

export function getMyPayslip(token: string, slipId: string) {
  return apiFetch<PayrollSlipRecord>(`/staff/me/payslips/${encodeURIComponent(slipId)}`, { token });
}
