import { apiFetch } from './client';
import { toQueryString } from './query';

export type AuditLogListQuery = {
  tenantId?: string;
  branchId?: string;
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  correlationId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
};

export function listAuditLogs(token: string, q: AuditLogListQuery) {
  return apiFetch<unknown>(`/audit-logs${toQueryString(q)}`, { token });
}

export function getAuditLog(token: string, id: string) {
  return apiFetch<unknown>(`/audit-logs/${encodeURIComponent(id)}`, { token });
}
