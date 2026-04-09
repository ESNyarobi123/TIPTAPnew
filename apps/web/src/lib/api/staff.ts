import { apiFetch } from './client';
import { toQueryString } from './query';

export type CreateStaffBody = {
  tenantId: string;
  branchId?: string | null;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  roleInTenant?: string | null;
  publicHandle?: string | null;
};

export type UpdateStaffBody = Partial<CreateStaffBody> & { tenantId?: string };
export type UpdateStaffInternalBody = { privateNotes?: string | null };

export type StaffAssignmentMode =
  | 'PART_TIME_SHARED'
  | 'FULL_TIME_EXCLUSIVE'
  | 'TEMPORARY_CONTRACT'
  | 'SHIFT_BASED';

export type CreateAssignmentBody = { branchId: string; mode?: StaffAssignmentMode };
export type UpdateAssignmentBody = { status?: 'ACTIVE' | 'ENDED'; endedAt?: string | null; mode?: StaffAssignmentMode };
export type StaffCompensationType = 'SALARY' | 'BONUS' | 'COMMISSION' | 'ADVANCE' | 'DEDUCTION';
export type StaffCompensationStatus = 'SCHEDULED' | 'APPROVED' | 'PAID' | 'VOID';
export type CreateStaffCompensationBody = {
  branchId?: string | null;
  type?: StaffCompensationType;
  status?: StaffCompensationStatus;
  amountCents: number;
  currency?: string | null;
  periodLabel?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  effectiveDate?: string | null;
  paidAt?: string | null;
  notes?: string | null;
};
export type UpdateStaffCompensationBody = Partial<CreateStaffCompensationBody>;
export type LinkProviderProfileBody = {
  tenantId: string;
  branchId: string;
  providerCode: string;
  mode?: StaffAssignmentMode;
  roleInTenant?: string | null;
};

export function listStaff(token: string, tenantId: string) {
  return apiFetch<unknown[]>(`/staff${toQueryString({ tenantId })}`, { token });
}

export function searchStaff(token: string, q: { tenantId: string; q: string }) {
  return apiFetch<unknown[]>(`/staff/search${toQueryString(q)}`, { token });
}

export function bulkCreateStaff(
  token: string,
  body: { tenantId: string; branchId: string; mode?: StaffAssignmentMode; roleInTenant?: string; lines: string },
) {
  return apiFetch<unknown>(`/staff/bulk-create`, { token, method: 'POST', json: body });
}

export function linkProviderProfile(token: string, body: LinkProviderProfileBody) {
  return apiFetch<unknown>(`/staff/link-provider-profile`, { token, method: 'POST', json: body });
}

export type CreateStaffJoinInviteBody = {
  tenantId: string;
  branchId: string;
  roleInTenant?: 'SERVICE_STAFF' | 'CASHIER' | 'SUPPORT_AGENT';
  mode?: StaffAssignmentMode;
  maxUses?: number;
  expiresInHours?: number;
};

export function createStaffJoinInvite(token: string, body: CreateStaffJoinInviteBody) {
  return apiFetch<{
    id: string;
    code: string;
    tenantId: string;
    branchId: string;
    maxUses: number;
    usesCount: number;
    expiresAt: string | null;
  }>('/staff/join-invites', { token, method: 'POST', json: body });
}

export function listStaffJoinInvites(token: string, tenantId: string) {
  return apiFetch<
    {
      id: string;
      code: string;
      branch: { id: string; name: string; code: string };
      maxUses: number;
      usesCount: number;
      expiresAt: string | null;
      revokedAt: string | null;
    }[]
  >(`/staff/join-invites${toQueryString({ tenantId })}`, { token });
}

export function revokeStaffJoinInvite(token: string, inviteId: string) {
  return apiFetch<{ id: string; revokedAt: string }>(`/staff/join-invites/${encodeURIComponent(inviteId)}/revoke`, {
    token,
    method: 'PATCH',
  });
}

export function redeemStaffJoinInvite(token: string, code: string) {
  return apiFetch<{
    consumedInvite: boolean;
    tenant: { id: string; name: string };
    branch: { id: string; name: string };
    staff: unknown;
  }>('/staff/join-invites/redeem', { token, method: 'POST', json: { code } });
}

export function getStaff(token: string, id: string) {
  return apiFetch<unknown>(`/staff/${encodeURIComponent(id)}`, { token });
}

export function getStaffInternal(token: string, id: string) {
  return apiFetch<unknown>(`/staff/${encodeURIComponent(id)}/internal`, { token });
}

export function createStaff(token: string, body: CreateStaffBody) {
  return apiFetch<unknown>('/staff', { method: 'POST', token, json: body });
}

export function updateStaff(token: string, id: string, body: UpdateStaffBody) {
  return apiFetch<unknown>(`/staff/${encodeURIComponent(id)}`, { method: 'PATCH', token, json: body });
}

export function updateStaffInternal(token: string, id: string, body: UpdateStaffInternalBody) {
  return apiFetch<unknown>(`/staff/${encodeURIComponent(id)}/internal`, { method: 'PATCH', token, json: body });
}

export function deactivateStaff(token: string, id: string) {
  return apiFetch<unknown>(`/staff/${encodeURIComponent(id)}/deactivate`, { method: 'POST', token });
}

export function deleteStaff(token: string, id: string) {
  return apiFetch<unknown>(`/staff/${encodeURIComponent(id)}`, { method: 'DELETE', token });
}

export function listAssignments(token: string, staffId: string) {
  return apiFetch<unknown[]>(`/staff/${encodeURIComponent(staffId)}/assignments`, { token });
}

export function listStaffCompensation(token: string, staffId: string) {
  return apiFetch<unknown[]>(`/staff/${encodeURIComponent(staffId)}/compensation`, { token });
}

export function createAssignment(token: string, staffId: string, body: CreateAssignmentBody) {
  return apiFetch<unknown>(`/staff/${encodeURIComponent(staffId)}/assignments`, { method: 'POST', token, json: body });
}

export function createStaffCompensation(token: string, staffId: string, body: CreateStaffCompensationBody) {
  return apiFetch<unknown>(`/staff/${encodeURIComponent(staffId)}/compensation`, { method: 'POST', token, json: body });
}

export function updateAssignment(token: string, staffId: string, assignmentId: string, body: UpdateAssignmentBody) {
  return apiFetch<unknown>(
    `/staff/${encodeURIComponent(staffId)}/assignments/${encodeURIComponent(assignmentId)}`,
    { method: 'PATCH', token, json: body },
  );
}

export function updateStaffCompensation(
  token: string,
  staffId: string,
  compensationId: string,
  body: UpdateStaffCompensationBody,
) {
  return apiFetch<unknown>(
    `/staff/${encodeURIComponent(staffId)}/compensation/${encodeURIComponent(compensationId)}`,
    { method: 'PATCH', token, json: body },
  );
}
