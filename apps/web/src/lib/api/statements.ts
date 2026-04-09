import { apiFetch } from './client';
import { toQueryString } from './query';

export function getStatement(
  token: string,
  q: { tenantId: string; branchId?: string; startDate: string; endDate: string },
) {
  return apiFetch<unknown>(`/statements${toQueryString(q)}`, { token });
}

export function getStatementByKey(token: string, statementKey: string) {
  const enc = encodeURIComponent(statementKey);
  return apiFetch<unknown>(`/statements/by-key/${enc}`, { token });
}

export function generateStatement(
  token: string,
  body: { tenantId: string; branchId?: string; startDate: string; endDate: string },
) {
  return apiFetch<unknown>('/statements/generate', { method: 'POST', token, json: body });
}
