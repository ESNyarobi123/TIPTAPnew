import { apiFetch } from './client';
import { toQueryString } from './query';

export function paymentsDashboardSummary(
  token: string,
  q: { tenantId?: string; branchId?: string },
) {
  return apiFetch<unknown>(`/payments/dashboard${toQueryString(q)}`, { token });
}

export function paymentsConfigHealth(
  token: string,
  q: { tenantId?: string; branchId?: string },
) {
  return apiFetch<unknown>(`/payments/dashboard/config-health${toQueryString(q)}`, { token });
}

export function paymentsRecentTransactions(
  token: string,
  q: { tenantId?: string; branchId?: string; page?: number; pageSize?: number },
) {
  return apiFetch<unknown>(`/payments/dashboard/recent-transactions${toQueryString(q)}`, { token });
}

export function paymentsReconciliationFlags(
  token: string,
  q: { tenantId?: string; branchId?: string },
) {
  return apiFetch<unknown>(`/payments/dashboard/reconciliation-flags${toQueryString(q)}`, { token });
}
