import { apiFetch } from './client';
import { toQueryString } from './query';

export type ReconciliationQuery = {
  tenantId?: string;
  branchId?: string;
  startDate?: string;
  endDate?: string;
};

export function reconciliationOverview(token: string, q: ReconciliationQuery) {
  return apiFetch<unknown>(`/reconciliation/overview${toQueryString(q)}`, { token });
}

export function reconciliationTransactions(
  token: string,
  q: ReconciliationQuery & {
    page?: number;
    pageSize?: number;
    mismatchOnly?: boolean;
    type?: string;
    status?: string;
  },
) {
  return apiFetch<unknown>(`/reconciliation/transactions${toQueryString(q)}`, { token });
}

export function reconciliationExceptions(token: string, q: ReconciliationQuery) {
  return apiFetch<unknown>(`/reconciliation/exceptions${toQueryString(q)}`, { token });
}
