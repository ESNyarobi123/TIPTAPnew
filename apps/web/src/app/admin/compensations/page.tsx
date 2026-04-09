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
import { adminListCompensations, type AdminCompensationRow } from '@/lib/api/admin-platform';
import { ApiError } from '@/lib/api/client';
import { downloadCsv } from '@/lib/csv-download';
import { formatMinorUnits } from '@/lib/format';
import type { PayrollLineKind } from '@/lib/api/staff';
import { listBranchesForTenant, listTenants } from '@/lib/api/tenants-branches';
import { getStoredToken } from '@/lib/auth/storage';
import { payrollLineLabel } from '@/lib/payroll';
import { toast } from '@/lib/toast';

const STATUSES = ['', 'SCHEDULED', 'APPROVED', 'PAID', 'VOID'] as const;
const TYPES = ['', 'SALARY', 'BONUS', 'COMMISSION', 'ADVANCE', 'DEDUCTION'] as const;
const LINE_KINDS = [
  '',
  'BASIC_SALARY',
  'ALLOWANCE',
  'COMMISSION',
  'BONUS',
  'TIP_SHARE',
  'OVERTIME',
  'SERVICE_CHARGE_SHARE',
  'ADJUSTMENT',
  'ADVANCE_RECOVERY',
  'DEDUCTION',
] as const;

export default function AdminCompensationsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AdminCompensationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [lineKind, setLineKind] = useState('');
  const [tenants, setTenants] = useState<{ id: string; name?: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name?: string }[]>([]);
  const [exportingAll, setExportingAll] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, tenantId, branchId, status, type, lineKind]);

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
      const res = await adminListCompensations(token, {
        tenantId: tenantId || undefined,
        branchId: branchId || undefined,
        status: status || undefined,
        type: type || undefined,
        lineKind: lineKind || undefined,
        q: debouncedQ || undefined,
        page,
        pageSize,
      });
      setRows(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load compensations');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedQ, tenantId, branchId, status, type, lineKind]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  const pendingCents = useMemo(
    () => rows.filter((r) => r.status === 'SCHEDULED' || r.status === 'APPROVED').reduce((a, b) => a + b.amountCents, 0),
    [rows],
  );
  const slippedRows = useMemo(() => rows.filter((row) => Boolean(row.payrollSlipId)).length, [rows]);
  const lockedRows = useMemo(() => rows.filter((row) => Boolean(row.lockedAt)).length, [rows]);

  const exportPageCsv = () => {
    downloadCsv(
      `tiptap-compensations-p${page}.csv`,
      [
        'Staff',
        'Tenant',
        'Branch',
        'Type',
        'Line kind',
        'Slip',
        'Status',
        'Locked',
        'Amount',
        'Currency',
        'Period',
        'Effective',
        'Paid',
        'Row id',
      ],
      rows.map((r) => [
        r.staff?.displayName ?? '',
        r.tenant?.name ?? '',
        r.branch?.name ?? '',
        r.type,
        r.lineKind ?? '',
        r.payrollSlip?.slipNumber ?? '',
        r.status,
        r.lockedAt ? 'YES' : 'NO',
        String(r.amountCents / 100),
        r.currency,
        r.periodLabel ?? '',
        r.effectiveDate ? new Date(r.effectiveDate).toISOString() : '',
        r.paidAt ? new Date(r.paidAt).toISOString() : '',
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
        adminListCompensations(token, {
          tenantId: tenantId || undefined,
          branchId: branchId || undefined,
          status: status || undefined,
          type: type || undefined,
          lineKind: lineKind || undefined,
          q: debouncedQ || undefined,
          page: p,
          pageSize: ps,
        }),
      );
      downloadCsv(
        `tiptap-compensations-all-${all.length}.csv`,
        [
          'Staff',
          'Tenant',
          'Branch',
          'Type',
          'Line kind',
          'Slip',
          'Status',
          'Locked',
          'Amount',
          'Currency',
          'Period',
          'Effective',
          'Paid',
          'Notes',
          'Row id',
        ],
        all.map((r) => [
          r.staff?.displayName ?? '',
          r.tenant?.name ?? '',
          r.branch?.name ?? '',
          r.type,
          r.lineKind ?? '',
          r.payrollSlip?.slipNumber ?? '',
          r.status,
          r.lockedAt ? 'YES' : 'NO',
          String(r.amountCents / 100),
          r.currency,
          r.periodLabel ?? '',
          r.effectiveDate ? new Date(r.effectiveDate).toISOString() : '',
          r.paidAt ? new Date(r.paidAt).toISOString() : '',
          (r.notes ?? '').replace(/\s+/g, ' ').slice(0, 200),
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

  if (!getStoredToken()) {
    return (
      <EmptyState
        variant="premium"
        icon="ph:lock-key-duotone"
        title="Sign in required"
        description="Super admin access is required for cross-tenant compensation visibility."
      />
    );
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="platform"
        eyebrow="Money & trust"
        title="Staff compensation"
        description="Salary, bonus, and other compensation rows across tenants. This is internal payroll-style data — not guest payment withdrawals. Filter, search staff name, export page or all (≤5k)."
      />

      {loading && !rows.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon="ph:hand-coins-duotone" label="Total (filtered)" value={total} hint="StaffCompensation rows" />
          <StatCard icon="ph:rows-duotone" label="This page" value={rows.length} />
          <StatCard
            icon="ph:clock-countdown-duotone"
            label="Pending+approved (page)"
            value={formatMinorUnits(pendingCents, rows[0]?.currency ?? 'TZS')}
          />
          <StatCard icon="fluent-color:receipt-item-24" label="With slip" value={slippedRows} />
          <StatCard icon="fluent-color:shield-lock-24" label="Locked" value={lockedRows} />
        </div>
      )}

      <Card className="border-smoke-400/10 shadow-card">
        <CardHeader className="border-b border-smoke-400/[0.06]">
          <CardTitle className="text-base">Compensation rows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <FilterBar>
            <div className="space-y-1">
              <Label htmlFor="co-tenant">Tenant</Label>
              <Select
                id="co-tenant"
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
              <Label htmlFor="co-branch">Branch</Label>
              <Select
                id="co-branch"
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
              <Label htmlFor="co-status">Status</Label>
              <Select id="co-status" className="h-10 min-w-[9rem]" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s || 'all'} value={s}>
                    {s || 'All statuses'}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="co-type">Type</Label>
              <Select id="co-type" className="h-10 min-w-[10rem]" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((s) => (
                  <option key={s || 'all'} value={s}>
                    {s || 'All types'}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="co-line-kind">Line</Label>
              <Select id="co-line-kind" className="h-10 min-w-[12rem]" value={lineKind} onChange={(e) => setLineKind(e.target.value)}>
                {LINE_KINDS.map((value) => (
                  <option key={value || 'all'} value={value}>
                    {value ? payrollLineLabel(value, null) : 'All lines'}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="co-q">Search</Label>
              <Input
                id="co-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Staff name, period, notes, id…"
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
            <EmptyState icon="ph:coins-duotone" title="No compensation rows" description="Create rows from tenant staff tools or imports." />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Staff</Th>
                    <Th>Tenant</Th>
                    <Th>Line</Th>
                    <Th>Slip</Th>
                    <Th>Status</Th>
                    <Th>Amount</Th>
                    <Th>Period</Th>
                    <Th>Effective</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <Td className="font-medium text-smoke-400">
                        <div>
                          <div>{r.staff?.displayName ?? '—'}</div>
                          <div className="text-xs text-smoke-200">{r.staff?.email ?? r.staffId}</div>
                        </div>
                      </Td>
                      <Td className="text-sm">
                        <div>
                          <div>{r.tenant?.name ?? '—'}</div>
                          <div className="text-xs text-smoke-200">{r.branch?.name ?? 'Tenant-wide'}</div>
                        </div>
                      </Td>
                      <Td className="text-xs">
                        <div className="space-y-1">
                          <div className="font-medium text-smoke-400">{payrollLineLabel((r.lineKind as PayrollLineKind | null | undefined) ?? null, r.label ?? null)}</div>
                          <div className="text-smoke-200">
                            {r.type.replaceAll('_', ' ')}
                            {r.sourceReference ? ` · ${r.sourceReference}` : ''}
                          </div>
                        </div>
                      </Td>
                      <Td className="text-xs text-smoke-200">
                        {r.payrollSlip ? (
                          <div className="space-y-1">
                            <div className="font-medium text-smoke-400">{r.payrollSlip.slipNumber}</div>
                            <div>{r.payrollSlip.status}</div>
                            <div>{r.lockedAt ? 'Locked' : 'Unlocked'}</div>
                          </div>
                        ) : (
                          <span>Unslipped</span>
                        )}
                      </Td>
                      <Td>
                        <StatusChip status={r.status} />
                      </Td>
                      <Td className="whitespace-nowrap text-sm font-medium">{formatMinorUnits(r.amountCents, r.currency)}</Td>
                      <Td className="text-xs text-smoke-200">{r.periodLabel ?? '—'}</Td>
                      <Td className="whitespace-nowrap text-xs text-smoke-200">
                        {r.effectiveDate ? new Date(r.effectiveDate).toLocaleDateString() : '—'}
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
