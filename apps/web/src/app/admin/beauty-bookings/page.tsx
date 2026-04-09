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
import { adminListBeautyBookings, type AdminBeautyBookingRow } from '@/lib/api/admin-platform';
import { ApiError } from '@/lib/api/client';
import { downloadCsv } from '@/lib/csv-download';
import { formatMinorUnits } from '@/lib/format';
import { listBranchesForTenant, listTenants } from '@/lib/api/tenants-branches';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';

const STATUSES = [
  '',
  'BOOKED',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_SERVICE',
  'COMPLETED',
  'PAID',
  'CANCELLED',
  'NO_SHOW',
] as const;

export default function AdminBeautyBookingsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AdminBeautyBookingRow[]>([]);
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
      const res = await adminListBeautyBookings(token, {
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
      toast.error(e instanceof ApiError ? e.message : 'Failed to load beauty bookings');
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

  const exportPageCsv = () => {
    downloadCsv(
      `tiptap-beauty-bookings-p${page}.csv`,
      ['Booking #', 'Tenant', 'Branch', 'Station', 'Status', 'Scheduled', 'Total', 'Customer', 'Phone', 'Provider', 'Walk-in', 'Created', 'Booking id'],
      rows.map((r) => [
        r.bookingNumber,
        r.tenant?.name ?? '',
        r.branch?.name ?? '',
        r.station ? `${r.station.code}${r.station.label ? ` (${r.station.label})` : ''}` : '',
        r.status,
        r.scheduledAt ? new Date(r.scheduledAt).toISOString() : '',
        String(r.totalCents / 100),
        r.customerName ?? '',
        r.customerPhone ?? '',
        r.staff?.displayName ?? '',
        r.isWalkIn ? 'yes' : 'no',
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
        adminListBeautyBookings(token, {
          tenantId: tenantId || undefined,
          branchId: branchId || undefined,
          status: status || undefined,
          q: debouncedQ || undefined,
          page: p,
          pageSize: ps,
        }),
      );
      downloadCsv(
        `tiptap-beauty-bookings-all-${all.length}.csv`,
        ['Booking #', 'Tenant', 'Branch', 'Station', 'Status', 'Scheduled', 'Total', 'Currency', 'Customer', 'Phone', 'Provider', 'Walk-in', 'Created', 'Booking id'],
        all.map((r) => [
          r.bookingNumber,
          r.tenant?.name ?? '',
          r.branch?.name ?? '',
          r.station ? `${r.station.code}${r.station.label ? ` (${r.station.label})` : ''}` : '',
          r.status,
          r.scheduledAt ? new Date(r.scheduledAt).toISOString() : '',
          String(r.totalCents / 100),
          r.currency,
          r.customerName ?? '',
          r.customerPhone ?? '',
          r.staff?.displayName ?? '',
          r.isWalkIn ? 'yes' : 'no',
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

  const upcomingCents = useMemo(
    () =>
      rows
        .filter((r) => !['COMPLETED', 'PAID', 'CANCELLED', 'NO_SHOW'].includes(r.status))
        .reduce((a, b) => a + b.totalCents, 0),
    [rows],
  );

  if (!getStoredToken()) {
    return (
      <EmptyState
        variant="premium"
        icon="ph:lock-key-duotone"
        title="Sign in required"
        description="Super admin access is required for cross-tenant beauty bookings."
      />
    );
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="platform"
        eyebrow="Beauty & Grooming"
        title="Beauty bookings"
        description="Appointments across all tenants. Filter by tenant, branch, status; search booking #, phone, name, or id. Export current page or all matching rows (up to 5k)."
      />

      {loading && !rows.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon="ph:scissors-duotone" label="Total (filtered)" value={total} hint="BeautyBooking rows" />
          <StatCard icon="ph:calendar-duotone" label="This page" value={rows.length} />
          <StatCard icon="ph:currency-circle-dollar-duotone" label="Open total (page)" value={formatMinorUnits(upcomingCents)} />
        </div>
      )}

      <Card className="border-smoke-400/10 shadow-card">
        <CardHeader className="border-b border-smoke-400/[0.06]">
          <CardTitle className="text-base">Bookings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <FilterBar>
            <div className="space-y-1">
              <Label htmlFor="bb-tenant">Tenant</Label>
              <Select
                id="bb-tenant"
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
              <Label htmlFor="bb-branch">Branch</Label>
              <Select
                id="bb-branch"
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
              <Label htmlFor="bb-status">Status</Label>
              <Select id="bb-status" className="h-10 min-w-[10rem]" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s || 'all'} value={s}>
                    {s || 'All statuses'}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="bb-q">Search</Label>
              <Input
                id="bb-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Booking #, phone, name, id…"
                className="h-10 min-w-[16rem]"
              />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Button type="button" variant="outline" onClick={() => void load()}>
                Refresh
              </Button>
              <Button type="button" variant="outline" onClick={exportPageCsv} disabled={!rows.length}>
                Export CSV (page)
              </Button>
              <Button type="button" variant="outline" onClick={() => void exportAllCsv()} disabled={exportingAll || total === 0}>
                {exportingAll ? 'Exporting…' : `Export all (≤${MAX_ADMIN_CSV_ROWS})`}
              </Button>
            </div>
          </FilterBar>

          {loading ? (
            <p className="text-sm text-smoke-200">Loading…</p>
          ) : rows.length === 0 ? (
            <EmptyState icon="ph:sparkle-duotone" title="No bookings" description="Adjust filters or create bookings in tenant tools." />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Booking</Th>
                    <Th>Tenant</Th>
                    <Th>Branch</Th>
                    <Th>Station</Th>
                    <Th>Status</Th>
                    <Th>Scheduled</Th>
                    <Th>Total</Th>
                    <Th>Customer</Th>
                    <Th>Provider</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <Td className="font-mono text-xs font-semibold">{r.bookingNumber}</Td>
                      <Td className="text-sm">{r.tenant?.name ?? '—'}</Td>
                      <Td className="text-sm text-smoke-200">{r.branch?.name ?? '—'}</Td>
                      <Td className="text-xs text-smoke-200">
                        {r.station ? `${r.station.code}${r.station.label ? ` · ${r.station.label}` : ''}` : '—'}
                      </Td>
                      <Td>
                        <StatusChip status={r.status} />
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-smoke-200">
                        {r.scheduledAt ? new Date(r.scheduledAt).toLocaleString() : '—'}
                      </Td>
                      <Td className="whitespace-nowrap text-sm">{formatMinorUnits(r.totalCents, r.currency)}</Td>
                      <Td className="text-sm">
                        {r.customerName ?? '—'}
                        {r.customerPhone ? (
                          <span className="block text-xs text-smoke-200">{r.customerPhone}</span>
                        ) : null}
                      </Td>
                      <Td className="text-sm text-smoke-200">{r.staff?.displayName ?? '—'}</Td>
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
