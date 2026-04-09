import { apiFetch } from './client';

export function createBranchForTenant(token: string, tenantId: string, body: Record<string, unknown>) {
  return apiFetch<unknown>(`/tenants/${encodeURIComponent(tenantId)}/branches`, {
    method: 'POST',
    token,
    json: body,
  });
}

export function upsertTenantCategory(token: string, tenantId: string, body: Record<string, unknown>) {
  return apiFetch<unknown>(`/tenants/${encodeURIComponent(tenantId)}/categories`, {
    method: 'POST',
    token,
    json: body,
  });
}

export function createSelfServeBusinessWorkspace(token: string, body: Record<string, unknown>) {
  return apiFetch<unknown>('/tenants/self-serve', {
    method: 'POST',
    token,
    json: body,
  });
}
