import { apiFetch } from './client';
import { toQueryString } from './query';

export function listTenants(token: string) {
  return apiFetch<unknown[]>('/tenants', { token });
}

export function getTenant(token: string, id: string) {
  return apiFetch<unknown>(`/tenants/${encodeURIComponent(id)}`, { token });
}

export function updateTenant(
  token: string,
  id: string,
  body: Record<string, unknown>,
) {
  return apiFetch<unknown>(`/tenants/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token,
    json: body,
  });
}

export function listTenantCategories(token: string, tenantId: string) {
  return apiFetch<unknown[]>(`/tenants/${encodeURIComponent(tenantId)}/categories`, { token });
}

export function listBranchesForTenant(token: string, tenantId: string) {
  return apiFetch<unknown[]>(`/tenants/${encodeURIComponent(tenantId)}/branches`, { token });
}

export function getBranch(token: string, branchId: string) {
  return apiFetch<unknown>(`/branches/${encodeURIComponent(branchId)}`, { token });
}

export function updateBranch(
  token: string,
  branchId: string,
  body: Record<string, unknown>,
) {
  return apiFetch<unknown>(`/branches/${encodeURIComponent(branchId)}`, {
    method: 'PATCH',
    token,
    json: body,
  });
}

export function listProviderConfigs(token: string, tenantId: string) {
  return apiFetch<unknown[]>(
    `/payments/provider-config${toQueryString({ tenantId })}`,
    { token },
  );
}

export function upsertProviderConfig(token: string, body: Record<string, unknown>) {
  return apiFetch<unknown>('/payments/provider-config', {
    method: 'POST',
    token,
    json: body,
  });
}

export function getUser(token: string, userId: string) {
  return apiFetch<unknown>(`/users/${encodeURIComponent(userId)}`, { token });
}

export function updateUser(token: string, userId: string, body: Record<string, unknown>) {
  return apiFetch<unknown>(`/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    token,
    json: body,
  });
}
