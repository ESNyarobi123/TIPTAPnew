'use client';

import { Icon } from '@iconify/react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { StatusChip } from '@/components/ui/status-chip';
import { Table, Td, Th } from '@/components/ui/table';
import { ApiError } from '@/lib/api/client';
import { listTenants, updateTenant } from '@/lib/api/tenants-branches';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';

type TenantRow = { id: string; name?: string; status?: string; slug?: string; createdAt?: string; subscriptionStatus?: string; subscriptionPlan?: string };

function asRow(x: unknown): TenantRow {
  const o = (x ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    name: typeof o.name === 'string' ? o.name : undefined,
    status: typeof o.status === 'string' ? o.status : undefined,
    slug: typeof o.slug === 'string' ? o.slug : undefined,
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : undefined,
    subscriptionStatus: typeof o.subscriptionStatus === 'string' ? o.subscriptionStatus : undefined,
    subscriptionPlan: typeof o.subscriptionPlan === 'string' ? o.subscriptionPlan : undefined,
  };
}

export default function AdminApprovalsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [pending, setPending] = useState<string | null>(null);

  async function load() {
    const token = getStoredToken();
    if (!token) return;
    setLoading(true);
    try {
      const raw = await listTenants(token);
      setRows((Array.isArray(raw) ? raw : []).map(asRow).filter((r) => r.id));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load tenants');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const trial = useMemo(() => rows.filter((r) => (r.status ?? '').toUpperCase() === 'TRIAL'), [rows]);
  const active = useMemo(() => rows.filter((r) => (r.status ?? '').toUpperCase() === 'ACTIVE'), [rows]);

  async function setStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED') {
    const token = getStoredToken();
    if (!token) return;
    setPending(id);
    try {
      await updateTenant(token, id, { status });
      toast.success(`Tenant marked ${status}`);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    } finally {
      setPending(null);
    }
  }

  if (!getStoredToken()) {
    return <EmptyState variant="premium" icon="ph:lock-key-duotone" title="Sign in required" description="Sign in to manage approvals." />;
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="platform"
        eyebrow="Provisioning"
        title="Approvals"
        description="Approve and activate businesses. This is the platform gate that turns sign-ups into operational tenants."
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon="ph:buildings-duotone" label="Total tenants" value={rows.length} />
          <StatCard icon="ph:hourglass-duotone" label="Pending (TRIAL)" value={trial.length} />
          <StatCard icon="ph:check-circle-duotone" label="Active" value={active.length} />
          <StatCard icon="ph:shield-warning-duotone" label="Suspended/archived" value={rows.length - trial.length - active.length} />
        </div>
      )}

      <Card className="border-smoke-400/10 shadow-card">
        <CardHeader className="border-b border-smoke-400/[0.06]">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon icon="ph:stamp-duotone" className="h-5 w-5 text-violet-900/70" aria-hidden />
            Approval queue
          </CardTitle>
          <p className="text-sm text-smoke-200">TRIAL tenants are treated as pending until you activate them.</p>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-sm text-smoke-200">Loading…</p>
          ) : trial.length === 0 ? (
            <EmptyState
              variant="premium"
              icon="ph:check-fat-duotone"
              title="No businesses pending approval"
              description="New tenant sign-ups will appear here while in TRIAL status."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Tenant</Th>
                  <Th>Status</Th>
                  <Th>Subscription</Th>
                  <Th>Created</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {trial.map((t) => (
                  <tr key={t.id}>
                    <Td>
                      <p className="font-medium text-smoke-400">{t.name ?? '—'}</p>
                      <p className="text-xs text-smoke-200">{t.slug ?? t.id.slice(0, 8)}</p>
                    </Td>
                    <Td>
                      <StatusChip status={t.status ?? '—'} />
                    </Td>
                    <Td className="text-xs text-smoke-200">
                      {t.subscriptionPlan ?? '—'} {t.subscriptionStatus ? `· ${t.subscriptionStatus}` : ''}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-smoke-200">
                      {t.createdAt ? new Date(t.createdAt).toLocaleString() : '—'}
                    </Td>
                    <Td className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="shadow-soft"
                          disabled={pending === t.id}
                          onClick={() => void setStatus(t.id, 'ACTIVE')}
                        >
                          {pending === t.id ? 'Working…' : 'Approve'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-smoke-400/18"
                          disabled={pending === t.id}
                          onClick={() => void setStatus(t.id, 'SUSPENDED')}
                        >
                          Suspend
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-smoke-400/18"
                          disabled={pending === t.id}
                          onClick={() => void setStatus(t.id, 'ARCHIVED')}
                        >
                          Archive
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

