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
import { adminListDiningOrders, type AdminDiningOrderRow } from '@/lib/api/admin-platform';
import { ApiError } from '@/lib/api/client';
import { downloadCsv } from '@/lib/csv-download';
import { formatMinorUnits } from '@/lib/format';
import { listBranchesForTenant, listTenants } from '@/lib/api/tenants-branches';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';

const STATUSES = ['', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'] as const;

export default function AdminDiningOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AdminDiningOrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState('');
  const [tenants, setTenants] = useState<{ id: string; name?: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name?: string }[]>([]);
  const [exportingAll, setExportingAll] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, tenantId, branchId, status]);

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

  useEffect(() => {
    const token = getStoredToken();
    if (!token || !tenantId) {
      setBranches([]);
      setBranchId('');
      return;
    }
    listBranchesForTenant(token, tenantId)
      .then((raw) => {
        const list = Array.isArray(raw) ? raw : [];
        setBranches(
          list
            .map((x: unknown) => {
              const o = (x ?? {}) as Record<string, unknown>;
              return { id: String(o.id ?? ''), name: typeof o.name === 'string' ? o.name : undefined };
            })
            .filter((b) => b.id),
        );
      })
      .catch(() => setBranches([]));
  }, [tenantId]);

  const load = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await adminListDiningOrders(token, {
        tenantId: tenantId || undefined,
        branchId: branchId || undefined,
        status: status || undefined,
        q: debouncedQ || undefined,
        page,
        pageSize,
      });
      setRows(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load dining orders');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedQ, tenantId, branchId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  const exportCsv = () => {
    downloadCsv(
      `tiptap-dining-orders-p${page}.csv`,
      ['Order #', 'Tenant', 'Branch', 'Status', 'Total', 'Currency', 'Waiter', 'Phone', 'Created', 'Order id'],
      rows.map((r) => [
        r.orderNumber,
        r.tenant?.name ?? '',
        r.branch?.name ?? '',
        r.status,
        String(r.totalCents / 100),
        r.currency,
        r.staff?.displayName ?? '',
        r.customerPhone ?? '',
        r.createdAt ? new Date(r.createdAt).toISOString() : '',
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
        adminListDiningOrders(token, {
          tenantId: tenantId || undefined,
          branchId: branchId || undefined,
          status: status || undefined,
          q: debouncedQ || undefined,
          page: p,
          pageSize: ps,
        }),
      );
      downloadCsv(
        `tiptap-dining-orders-all-${all.length}.csv`,
        ['Order #', 'Tenant', 'Branch', 'Status', 'Total', 'Currency', 'Waiter', 'Phone', 'Created', 'Order id'],
        all.map((r) => [
          r.orderNumber,
          r.tenant?.name ?? '',
          r.branch?.name ?? '',
          r.status,
          String(r.totalCents / 100),
          r.currency,
          r.staff?.displayName ?? '',
          r.customerPhone ?? '',
          r.createdAt ? new Date(r.createdAt).toISOString() : '',
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

  const activeCents = useMemo(
    () => rows.filter((r) => !['COMPLETED', 'CANCELLED'].includes(r.status)).reduce((a, b) => a + b.totalCents, 0),
    [rows],
  );

  if (!getStoredToken()) {
    return (
      <EmptyState
        variant="premium"
        icon="ph:lock-key-duotone"
        title="Sign in required"
        description="Super admin access is required for cross-tenant dining orders."
      />
    );
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="platform"
        eyebrow="Food & Dining"
        title="Dining orders"
        description="Kitchen / floor dining orders across all tenants (multi-branch). Filter by tenant, branch, status, or search order number, phone, id. Export current page or all matching rows (up to 5k)."
      />

      {loading && !rows.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon="ph:fork-knife-duotone" label="Total (filtered)" value={total} hint="DiningOrder rows" />
          <StatCard icon="ph:receipt-duotone" label="This page" value={rows.length} />
          <StatCard icon="ph:currency-circle-dollar-duotone" label="Active total (page)" value={formatMinorUnits(activeCents)} />
        </div>
      )}

      <Card className="border-smoke-400/10 shadow-card">
        <CardHeader className="border-b border-smoke-400/[0.06]">
          <CardTitle className="text-base">Orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <FilterBar>
            <div className="space-y-1">
              <Label htmlFor="do-tenant">Tenant</Label>
              <Select
                id="do-tenant"
                className="h-10 min-w-[12rem]"
                value={tenantId}
                onChange={(e) => {
                  setTenantId(e.target.value);
                  setBranchId('');
                }}
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
              <Label htmlFor="do-branch">Branch</Label>
              <Select
                id="do-branch"
                className="h-10 min-w-[12rem]"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={!tenantId}
              >
                <option value="">{tenantId ? 'All branches' : 'Pick tenant first'}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name ?? b.id.slice(0, 8)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="do-status">Status</Label>
              <Select id="do-status" className="h-10 min-w-[10rem]" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s || 'all'} value={s}>
                    {s || 'All statuses'}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="do-q">Search</Label>
              <Input
                id="do-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Order #, phone, id…"
                className="h-10 min-w-[16rem]"
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
            <EmptyState icon="ph:bowl-food-duotone" title="No dining orders" description="Adjust filters or wait for guest orders." />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Order</Th>
                    <Th>Tenant</Th>
                    <Th>Branch</Th>
                    <Th>Status</Th>
                    <Th>Total</Th>
                    <Th>Waiter</Th>
                    <Th>Phone</Th>
                    <Th>Created</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <Td className="font-mono text-xs font-semibold">{r.orderNumber}</Td>
                      <Td className="text-sm">{r.tenant?.name ?? '—'}</Td>
                      <Td className="text-sm text-smoke-200">{r.branch?.name ?? '—'}</Td>
                      <Td>
                        <StatusChip status={r.status} />
                      </Td>
                      <Td className="whitespace-nowrap text-sm">{formatMinorUnits(r.totalCents, r.currency)}</Td>
                      <Td className="text-sm text-smoke-200">{r.staff?.displayName ?? '—'}</Td>
                      <Td className="text-xs">{r.customerPhone ?? '—'}</Td>
                      <Td className="whitespace-nowrap text-xs text-smoke-200">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
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
