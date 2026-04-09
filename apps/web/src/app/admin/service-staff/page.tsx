'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { StatusChip } from '@/components/ui/status-chip';
import { Table, Td, Th } from '@/components/ui/table';
import { fetchAllAdminPages, MAX_ADMIN_CSV_ROWS } from '@/lib/admin-fetch-all-pages';
import { adminListStaff, type AdminStaffRow } from '@/lib/api/admin-platform';
import { ApiError } from '@/lib/api/client';
import { downloadCsv } from '@/lib/csv-download';
import { listTenants } from '@/lib/api/tenants-branches';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';

export default function AdminServiceStaffPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AdminStaffRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [tenants, setTenants] = useState<{ id: string; name?: string }[]>([]);
  const [exportingAll, setExportingAll] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, tenantId]);

  const loadTenants = useCallback(() => {
    const token = getStoredToken();
    if (!token) return;
    listTenants(token)
      .then((raw) => {
        const list = Array.isArray(raw) ? raw : [];
        setTenants(
          list
            .map((x: unknown) => {
              const o = (x ?? {}) as Record<string, unknown>;
              return { id: String(o.id ?? ''), name: typeof o.name === 'string' ? o.name : undefined };
            })
            .filter((t) => t.id),
        );
      })
      .catch(() => setTenants([]));
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const load = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await adminListStaff(token, {
        tenantId: tenantId || undefined,
        q: debouncedQ || undefined,
        page,
        pageSize,
      });
      setRows(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load staff');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedQ, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  const exportCsv = () => {
    downloadCsv(
      `tiptap-service-staff-p${page}.csv`,
      ['Name', 'Tenant', 'Branch', 'Role', 'Status', 'Provider code', 'Handle', 'Staff id'],
      rows.map((r) => [
        r.displayName,
        r.tenant?.name ?? '',
        r.branch?.name ?? '',
        r.roleInTenant.replaceAll('_', ' '),
        r.status,
        r.providerProfile?.registryCode ?? '',
        r.publicHandle ?? '',
        r.id,
      ]),
    );
    toast.success('CSV downloaded (current page)');
  };

  async function exportAllCsv() {
    const token = getStoredToken();
    if (!token) return;
    setExportingAll(true);
    try {
      const all = await fetchAllAdminPages((p, ps) =>
        adminListStaff(token, {
          tenantId: tenantId || undefined,
          q: debouncedQ || undefined,
          page: p,
          pageSize: ps,
        }),
      );
      downloadCsv(
        `tiptap-service-staff-all-${all.length}.csv`,
        ['Name', 'Tenant', 'Branch', 'Role', 'Status', 'Provider code', 'Handle', 'Staff id'],
        all.map((r) => [
          r.displayName,
          r.tenant?.name ?? '',
          r.branch?.name ?? '',
          r.roleInTenant.replaceAll('_', ' '),
          r.status,
          r.providerProfile?.registryCode ?? '',
          r.publicHandle ?? '',
          r.id,
        ]),
      );
      toast.success(`Exported ${all.length} row(s) (cap ${MAX_ADMIN_CSV_ROWS})`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Export failed');
    } finally {
      setExportingAll(false);
    }
  }

  const filteredHint = useMemo(() => {
    if (!tenantId && !debouncedQ) return 'All tenants';
    return [tenantId ? 'tenant filter' : null, debouncedQ ? 'search' : null].filter(Boolean).join(' · ');
  }, [tenantId, debouncedQ]);

  if (!getStoredToken()) {
    return (
      <EmptyState
        variant="premium"
        icon="ph:lock-key-duotone"
        title="Sign in required"
        description="Super admin access is required for the platform staff directory."
      />
    );
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="platform"
        eyebrow="Platform core"
        title="Service staff"
        description="Cross-tenant directory of staff records (waiters, floor team, linked provider profiles). Filter by tenant or search by name, email, phone, handle, or id. Export current page or all matching rows (up to 5k)."
      />

      {loading && !rows.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon="ph:users-three-duotone" label="Total (filtered)" value={total} hint={filteredHint} />
          <StatCard icon="ph:identification-badge-duotone" label="This page" value={rows.length} />
          <StatCard icon="ph:buildings-duotone" label="Page" value={`${page} / ${pages}`} />
        </div>
      )}

      <Card className="border-smoke-400/10 shadow-card">
        <CardHeader className="border-b border-smoke-400/[0.06]">
          <CardTitle className="text-base">Directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <FilterBar>
            <div className="space-y-1">
              <Label htmlFor="as-tenant">Tenant</Label>
              <Select
                id="as-tenant"
                className="h-10 min-w-[12rem]"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
              >
                <option value="">All tenants</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name ?? t.id.slice(0, 8)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="as-q">Search</Label>
              <Input
                id="as-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, email, phone, handle, id…"
                className="h-10 min-w-[18rem]"
              />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Button type="button" variant="outline" onClick={() => void load()}>
                Refresh
              </Button>
              <Button type="button" variant="outline" onClick={exportCsv} disabled={!rows.length}>
                Export CSV (page)
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void exportAllCsv()}
                disabled={exportingAll || total === 0}
              >
                {exportingAll ? 'Exporting…' : `Export all (≤${MAX_ADMIN_CSV_ROWS})`}
              </Button>
            </div>
          </FilterBar>

          {loading ? (
            <p className="text-sm text-smoke-200">Loading…</p>
          ) : rows.length === 0 ? (
            <EmptyState icon="ph:users-duotone" title="No staff rows" description="Try clearing filters or search." />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Tenant</Th>
                    <Th>Branch</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                    <Th>Provider</Th>
                    <Th>Updated</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <Td className="font-medium text-smoke-400">{r.displayName}</Td>
                      <Td className="text-sm">{r.tenant?.name ?? '—'}</Td>
                      <Td className="text-sm text-smoke-200">{r.branch?.name ?? '—'}</Td>
                      <Td className="text-xs">{r.roleInTenant.replaceAll('_', ' ')}</Td>
                      <Td>
                        <StatusChip status={r.status} />
                      </Td>
                      <Td className="font-mono text-xs text-smoke-200">
                        {r.providerProfile?.registryCode ?? r.publicHandle ?? '—'}
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-smoke-200">
                        {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-smoke-200">
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
