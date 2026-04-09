import { apiFetch } from './client';

export type UserListRow = {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt?: string;
  roles?: { id: string; role: string; tenantId?: string | null; branchId?: string | null; createdAt?: string }[];
};

export function adminListUsers(token: string) {
  return apiFetch<UserListRow[]>('/users', { token });
}

export function adminGrantRole(
  token: string,
  userId: string,
  body: { role: string; tenantId?: string; branchId?: string },
) {
  return apiFetch<unknown>(`/users/${encodeURIComponent(userId)}/role-assignments`, {
    method: 'POST',
    token,
    json: body,
  });
}

export function adminRevokeRole(token: string, userId: string, assignmentId: string) {
  return apiFetch<unknown>(`/users/${encodeURIComponent(userId)}/role-assignments/${encodeURIComponent(assignmentId)}`, {
    method: 'DELETE',
    token,
  });
}

export function adminImpersonate(token: string, userId: string) {
  return apiFetch<{ accessToken: string; expiresIn?: number }>(`/auth/impersonate`, {
    method: 'POST',
    token,
    json: { userId },
  });
}

