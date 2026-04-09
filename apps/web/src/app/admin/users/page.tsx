'use client';

import Link from 'next/link';
import { Icon } from '@iconify/react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { StatusChip } from '@/components/ui/status-chip';
import { Table, Td, Th } from '@/components/ui/table';
import { adminGrantRole, adminListUsers, adminRevokeRole } from '@/lib/api/admin';
import { listBranchesForTenant, listTenants } from '@/lib/api/tenants-branches';
import { ApiError } from '@/lib/api/client';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';

type TenantRow = { id: string; name?: string };
type BranchRow = { id: string; name?: string };

const ROLE_OPTIONS = [
  'SUPER_ADMIN',
  'TENANT_OWNER',
  'BRANCH_MANAGER',
  'SERVICE_STAFF',
  'CASHIER',
  'SUPPORT_AGENT',
] as const;

const ROLE_GUIDE = [
  {
    code: 'SUPER_ADMIN',
    label: 'Super admin',
    body: 'Platform-wide power. No scope.',
    icon: 'fluent-color:apps-48',
  },
  {
    code: 'TENANT_OWNER',
    label: 'Tenant owner',
    body: 'Business-wide control. Tenant only.',
    icon: 'fluent-color:building-store-24',
  },
  {
    code: 'BRANCH_MANAGER',
    label: 'Branch manager',
    body: 'Branch operations. Tenant + branch.',
    icon: 'fluent-color:building-people-24',
  },
  {
    code: 'SERVICE_STAFF',
    label: 'Service staff',
    body: 'Personal work access. Tenant + branch.',
    icon: 'fluent-color:contact-card-48',
  },
  {
    code: 'CASHIER',
    label: 'Cashier',
    body: 'Payment access. Tenant + branch.',
    icon: 'fluent-color:coin-multiple-48',
  },
  {
    code: 'SUPPORT_AGENT',
    label: 'Support agent',
    body: 'Support access. Usually tenant + branch.',
    icon: 'fluent-color:person-feedback-48',
  },
] as const;

function requiresTenant(role: string) {
  return role !== 'SUPER_ADMIN';
}

function requiresBranch(role: string) {
  return role === 'BRANCH_MANAGER' || role === 'SERVICE_STAFF' || role === 'CASHIER' || role === 'SUPPORT_AGENT';
}

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [role, setRole] = useState<string>('BRANCH_MANAGER');
  const [tenantId, setTenantId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [pending, setPending] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => String(r.email ?? '').toLowerCase().includes(needle) || String(r.name ?? '').toLowerCase().includes(needle));
  }, [rows, q]);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of rows) {
      for (const assignment of row.roles ?? []) {
        const key = String(assignment.role ?? '');
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
    return counts;
  }, [rows]);

  const needsTenant = requiresTenant(role);
  const needsBranch = requiresBranch(role);
  const missingTenant = needsTenant && !tenantId;
  const missingBranch = needsBranch && !branchId;
  const canGrant = Boolean(targetUserId && !missingTenant && !missingBranch && !pending);

  async function loadAll() {
    const token = getStoredToken();
    if (!token) return;
    setLoading(true);
    try {
      const [u, t] = await Promise.all([adminListUsers(token), listTenants(token)]);
      setRows(Array.isArray(u) ? u : []);
      const trs: TenantRow[] = Array.isArray(t)
        ? (t as Record<string, unknown>[]).map((x) => ({ id: String(x.id), name: typeof x.name === 'string' ? x.name : undefined }))
        : [];
      setTenants(trs);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token || !tenantId) {
      setBranches([]);
      setBranchId('');
      return;
    }
    listBranchesForTenant(token, tenantId)
      .then((raw) => {
        const arr = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
        setBranches(arr.map((b) => ({ id: String(b.id), name: typeof b.name === 'string' ? b.name : undefined })));
      })
      .catch(() => setBranches([]));
  }, [tenantId]);

  useEffect(() => {
    if (!requiresTenant(role)) {
      setTenantId('');
      setBranchId('');
      setBranches([]);
      return;
    }
    if (!requiresBranch(role)) {
      setBranchId('');
    }
  }, [role]);

  async function grant() {
    const token = getStoredToken();
    if (!token || !targetUserId || !role) return;
    setPending(true);
    try {
      await adminGrantRole(token, targetUserId, {
        role,
        ...(requiresTenant(role) && tenantId ? { tenantId } : {}),
        ...(requiresBranch(role) && branchId ? { branchId } : {}),
      });
      toast.success('Role granted');
      await loadAll();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Grant failed');
    } finally {
      setPending(false);
    }
  }

  async function revoke(userId: string, assignmentId: string) {
    const token = getStoredToken();
    if (!token) return;
    try {
      await adminRevokeRole(token, userId, assignmentId);
      toast.success('Role revoked');
      await loadAll();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Revoke failed');
    }
  }

  if (!getStoredToken()) {
    return <EmptyState variant="premium" icon="ph:lock-key-duotone" title="Sign in required" description="Sign in to manage users." />;
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="platform"
        eyebrow="Identity & RBAC"
        title="Users"
        description="Grant and revoke scoped roles."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-smoke-400/10 shadow-card lg:col-span-2">
          <CardHeader className="border-b border-smoke-400/[0.06]">
            <CardTitle className="text-base">Directory</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <FilterBar>
              <div className="space-y-1">
                <Label htmlFor="u-q">Search</Label>
                <Input id="u-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="email or name" className="h-10 min-w-[14rem]" />
              </div>
            </FilterBar>

            {loading ? (
              <div className="mt-4 space-y-3">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="mt-6 text-center text-sm text-smoke-200">No users match this filter.</p>
            ) : (
              <div className="mt-4">
                <Table>
                  <thead>
                    <tr>
                      <Th>User</Th>
                      <Th>Roles</Th>
                      <Th className="text-right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 200).map((r) => (
                      <tr key={r.id}>
                        <Td>
                          <p className="font-medium text-smoke-400">{r.name ?? r.email}</p>
                          <p className="text-xs text-smoke-200">{r.email}</p>
                          {!r.isActive ? <p className="mt-1 text-xs text-rose-900">Inactive</p> : null}
                        </Td>
                        <Td className="text-xs">
                          <div className="flex flex-wrap gap-1.5">
                            {(r.roles ?? []).length ? (
                              (r.roles ?? []).map((a: any) => (
                                <button
                                  key={a.id}
                                  type="button"
                                  onClick={() => void revoke(String(r.id), String(a.id))}
                                  className="inline-flex items-center gap-1 rounded-full border border-smoke-400/10 bg-ivory-100/70 px-2 py-0.5 text-left transition hover:border-smoke-400/18 hover:bg-ivory-50"
                                  title="Click to revoke"
                                >
                                  <StatusChip status={String(a.role)} />
                                  <span className="text-[11px] text-smoke-200">
                                    {a.tenantId ? a.tenantId.slice(0, 6) : '—'}
                                    {a.branchId ? `/${a.branchId.slice(0, 6)}` : ''}
                                  </span>
                                  <span className="ml-1 text-[11px] font-semibold text-rose-900/80">×</span>
                                </button>
                              ))
                            ) : (
                              <span className="text-smoke-200">None</span>
                            )}
                          </div>
                        </Td>
                        <Td className="text-right">
                          <Button type="button" size="sm" variant="outline" className="border-smoke-400/18" onClick={() => setTargetUserId(r.id)}>
                            Select
                          </Button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-smoke-400/10 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Provision access</CardTitle>
            <p className="text-[13px] text-smoke-200">Grant a role to unlock access.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="u-target">User ID</Label>
              <Input id="u-target" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} placeholder="paste user id" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-role">Role</Label>
              <Select id="u-role" value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLE_OPTIONS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-tenant">Tenant</Label>
              <Select
                id="u-tenant"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                disabled={!needsTenant}
              >
                <option value="">Select tenant</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name ?? t.id.slice(0, 8)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-branch">Branch</Label>
              <Select
                id="u-branch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={!tenantId || !needsBranch}
              >
                <option value="">Select branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name ?? b.id.slice(0, 8)}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-smoke-200">
                {needsTenant
                  ? needsBranch
                    ? 'Needs tenant + branch.'
                    : 'Needs tenant only.'
                  : 'Keep super admin unscoped.'}
              </p>
            </div>

            {missingTenant ? (
              <div className="rounded-xl border border-amber-900/10 bg-amber-50/60 p-4 text-sm text-amber-950">
                <div className="flex gap-2.5">
                  <Icon icon="ph:warning-circle-duotone" className="mt-0.5 h-5 w-5 shrink-0 text-amber-900/80" aria-hidden />
                  <div className="space-y-1">
                    <p className="font-medium">Choose a tenant first.</p>
                    <p>`TENANT_OWNER` needs a tenant only.</p>
                    {tenants.length === 0 ? (
                      <p>
                        No tenants yet.
                        <span> </span>
                        <Link href="/admin/tenants" className="font-semibold underline underline-offset-4">
                          Open tenants
                        </Link>
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {missingBranch ? (
              <div className="rounded-xl border border-amber-900/10 bg-amber-50/60 p-4 text-sm text-amber-950">
                <div className="flex gap-2.5">
                  <Icon icon="ph:warning-circle-duotone" className="mt-0.5 h-5 w-5 shrink-0 text-amber-900/80" aria-hidden />
                  <div className="space-y-1">
                    <p className="font-medium">Choose a branch too.</p>
                    <p>`{role}` needs tenant + branch.</p>
                  </div>
                </div>
              </div>
            ) : null}

            <Button type="button" size="lg" className="w-full shadow-soft" disabled={!canGrant} onClick={() => void grant()}>
              {pending ? 'Granting…' : 'Grant role'}
            </Button>

            <div className="rounded-xl border border-violet-900/10 bg-violet-50/25 p-4 text-sm text-smoke-200">
              <div className="flex gap-2.5">
                <Icon icon="ph:info-duotone" className="mt-0.5 h-5 w-5 text-violet-900/70" aria-hidden />
                <p>Users stay in <span className="font-medium">Access pending</span> until roles are granted.</p>
              </div>
            </div>

            <p className="text-xs text-smoke-200">Click any role chip to revoke it.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <StatCard icon="fluent-color:apps-48" label="Super admins" value={roleCounts.SUPER_ADMIN ?? 0} hint="Platform authority" />
        <StatCard icon="fluent-color:building-store-24" label="Tenant owners" value={roleCounts.TENANT_OWNER ?? 0} hint="Merchant control" />
        <StatCard
          icon="fluent-color:contact-card-48"
          label="Service staff roles"
          value={roleCounts.SERVICE_STAFF ?? 0}
          hint="Personal access"
        />
      </div>

      <Card className="border-smoke-400/10 shadow-card">
        <CardHeader className="border-b border-smoke-400/[0.06]">
          <CardTitle className="text-base">Role guide</CardTitle>
          <p className="text-[13px] text-smoke-200">Use the right role with the right scope.</p>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-3">
          {ROLE_GUIDE.map((entry) => (
            <div key={entry.code} className="rounded-[1.3rem] border border-smoke-400/[0.08] bg-ivory-50/92 p-4 shadow-soft">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 ring-1 ring-smoke-400/[0.05]">
                  <Icon icon={entry.icon} className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="font-display text-lg font-semibold text-smoke-400">{entry.label}</p>
                  <p className="mt-1 text-[13px] text-smoke-200">{entry.body}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-smoke-200">
                    Active assignments: {roleCounts[entry.code] ?? 0}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
