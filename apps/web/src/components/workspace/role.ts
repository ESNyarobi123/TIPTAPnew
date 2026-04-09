export type RoleCode =
  | 'SUPER_ADMIN'
  | 'TENANT_OWNER'
  | 'BRANCH_MANAGER'
  | 'CASHIER'
  | 'SERVICE_STAFF'
  | 'SUPPORT_AGENT';

export type WorkspaceKey = 'admin' | 'dashboard' | 'provider';

export function pickPrimaryWorkspace(
  roles: { role: string; tenantId?: string | null; branchId?: string | null }[],
): WorkspaceKey | null {
  const codes = new Set(roles.map((r) => r.role));
  if (codes.has('SUPER_ADMIN')) return 'admin' as const;

  const managerish = codes.has('TENANT_OWNER') || codes.has('BRANCH_MANAGER');
  if (managerish) return 'dashboard' as const;

  const providerish = codes.has('SERVICE_STAFF') || codes.has('CASHIER') || codes.has('SUPPORT_AGENT');
  if (providerish) return 'provider' as const;

  return null;
}

