'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { KeyValueList } from '@/components/ui/key-value-list';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { StatusChip } from '@/components/ui/status-chip';
import { Table, Td, Th } from '@/components/ui/table';
import { adminListUsers } from '@/lib/api/admin';
import { paymentsConfigHealth } from '@/lib/api/payments-dashboard';
import { ApiError } from '@/lib/api/client';
import { getStoredToken } from '@/lib/auth/storage';
import { listBranchesForTenant, listTenantCategories, getTenant, updateTenant } from '@/lib/api/tenants-branches';
import { toast } from '@/lib/toast';

export default function AdminTenantDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<Record<string, unknown> | null>(null);
  const [cats, setCats] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [cfgHealth, setCfgHealth] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [pending, setPending] = useState(false);

  async function loadAll() {
    const token = getStoredToken();
    if (!token || !id) return;
    setLoading(true);
    try {
      const [t, c, b, h, u] = await Promise.all([
        getTenant(token, id),
        listTenantCategories(token, id),
        listBranchesForTenant(token, id),
        paymentsConfigHealth(token, { tenantId: id }),
        adminListUsers(token),
      ]);
      setTenant((t ?? null) as any);
      setCats(Array.isArray(c) ? c : []);
      setBranches(Array.isArray(b) ? b : []);
      setCfgHealth(h ?? null);
      setUsers(Array.isArray(u) ? u : []);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load tenant');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [id]);

  const owners = useMemo(
    () =>
      users.filter((u) =>
        (u.roles ?? []).some((r: any) => r.role === 'TENANT_OWNER' && r.tenantId === id),
      ),
    [users, id],
  );

  async function setStatus(status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | 'TRIAL') {
    const token = getStoredToken();
    if (!token || !id) return;
    setPending(true);
    try {
      await updateTenant(token, id, { status });
      toast.success(`Tenant marked ${status}`);
      await loadAll();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    } finally {
      setPending(false);
    }
  }

  if (!getStoredToken()) {
    return <EmptyState variant="premium" icon="ph:lock-key-duotone" title="Sign in required" description="Sign in to view tenant details." />;
  }

  if (!id) {
    return <EmptyState variant="premium" icon="ph:buildings-duotone" title="Tenant not found" description="Missing tenant id." />;
  }

  const name = typeof tenant?.name === 'string' ? (tenant.name as string) : id.slice(0, 8);
  const status = typeof tenant?.status === 'string' ? (tenant.status as string) : '—';

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="platform"
        eyebrow="Tenant detail"
        title={name}
        description="Status, categories, branches, payment integration health, and role provisioning."
        action={
          <Link href="/admin/tenants" className="rounded-xl border border-smoke-400/12 bg-ivory-50 px-4 py-2 text-sm font-medium text-smoke-400 shadow-soft transition hover:border-smoke-400/20">
            ← Back to tenants
          </Link>
        }
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-12">
          <Skeleton className="h-36 rounded-2xl md:col-span-7" />
          <Skeleton className="h-36 rounded-2xl md:col-span-5" />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-smoke-400/10 shadow-card lg:col-span-2">
          <CardHeader className="border-b border-smoke-400/[0.06]">
            <CardTitle className="text-base">Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <KeyValueList
              rows={[
                { label: 'Tenant ID', value: id },
                { label: 'Slug', value: (tenant?.slug as string) ?? '—' },
                { label: 'Status', value: <StatusChip status={status} /> },
                { label: 'Email', value: (tenant?.email as string) ?? '—' },
                { label: 'Phone', value: (tenant?.phone as string) ?? '—' },
              ]}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => void setStatus('ACTIVE')}
                className="rounded-xl bg-smoke-400 px-4 py-2 text-sm font-medium text-ivory-100 shadow-soft transition hover:bg-smoke-300 disabled:opacity-40"
              >
                Activate
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void setStatus('SUSPENDED')}
                className="rounded-xl border border-smoke-400/15 bg-ivory-50 px-4 py-2 text-sm font-medium text-smoke-400 shadow-soft transition hover:border-smoke-400/20 disabled:opacity-40"
              >
                Suspend
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void setStatus('ARCHIVED')}
                className="rounded-xl border border-smoke-400/15 bg-ivory-50 px-4 py-2 text-sm font-medium text-smoke-400 shadow-soft transition hover:border-smoke-400/20 disabled:opacity-40"
              >
                Archive
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-smoke-400/10 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Provisioning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-smoke-200">Owners assigned</p>
            {owners.length ? (
              <ul className="space-y-2">
                {owners.map((o) => (
                  <li key={o.id} className="rounded-xl border border-smoke-400/[0.07] bg-ivory-50/90 px-3 py-2 text-sm">
                    <p className="font-medium text-smoke-400">{o.name ?? o.email}</p>
                    <p className="text-xs text-smoke-200">{o.email}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState className="border-none bg-transparent py-8" icon="ph:user-plus-duotone" title="No owner assigned" description="Grant TENANT_OWNER to a user to unlock manager access." />
            )}
            <div className="rounded-xl border border-violet-900/10 bg-violet-50/25 p-3 text-xs text-smoke-200">
              Use the Users page to grant branch roles for staff. This panel focuses on TENANT_OWNER.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="ph:tag-duotone" label="Category rows" value={cats.length} />
        <StatCard icon="ph:map-pin-duotone" label="Branches" value={branches.length} />
        <StatCard icon="ph:plug-duotone" label="Providers (health)" value={(cfgHealth?.providers?.length ?? 0) as any} />
        <StatCard icon="ph:waveform-duotone" label="Config note" value={cfgHealth?.note ? 'See below' : '—'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-smoke-400/10 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {cats.length === 0 ? (
              <EmptyState icon="ph:tag-duotone" title="No category assignments" description="Enable Food & Dining or Beauty & Grooming to unlock category-native modules." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Category</Th>
                    <Th>Enabled</Th>
                    <Th>Updated</Th>
                  </tr>
                </thead>
                <tbody>
                  {cats.slice(0, 20).map((c: any, i: number) => (
                    <tr key={c.id ?? i}>
                      <Td className="font-medium text-smoke-400">{String(c.category ?? '—')}</Td>
                      <Td>{c.enabled ? <StatusChip status="ENABLED" /> : <StatusChip status="DISABLED" />}</Td>
                      <Td className="text-xs text-smoke-200">{c.updatedAt ? new Date(String(c.updatedAt)).toLocaleString() : '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-smoke-400/10 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Branches</CardTitle>
          </CardHeader>
          <CardContent>
            {branches.length === 0 ? (
              <EmptyState icon="ph:map-pin-duotone" title="No branches" description="Create a branch to start branch-scoped roles and operations." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Code</Th>
                    <Th>ID</Th>
                  </tr>
                </thead>
                <tbody>
                  {branches.slice(0, 20).map((b: any) => (
                    <tr key={String(b.id)}>
                      <Td className="font-medium text-smoke-400">{String(b.name ?? '—')}</Td>
                      <Td className="text-xs text-smoke-200">{String(b.code ?? '—')}</Td>
                      <Td className="text-xs text-smoke-200">{String(b.id).slice(0, 8)}…</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

