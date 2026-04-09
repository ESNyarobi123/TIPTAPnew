'use client';

import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChartCard } from '@/components/ui/chart-card';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MetricMini } from '@/components/ui/metric-mini';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusChip } from '@/components/ui/status-chip';
import { Table, Td, Th } from '@/components/ui/table';
import { ApiError } from '@/lib/api/client';
import {
  reconciliationExceptions,
  reconciliationOverview,
  reconciliationTransactions,
} from '@/lib/api/reconciliation';
import { defaultDateRange, formatMinorUnits } from '@/lib/format';
import { getStoredToken } from '@/lib/auth/storage';
import { useScope } from '@/providers/scope-provider';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export default function ReconciliationPage() {
  const { tenantId, branchId, loading: scopeLoading } = useScope();
  const def = defaultDateRange();
  const [startDate, setStartDate] = useState(def.startDate);
  const [endDate, setEndDate] = useState(def.endDate);
  const [mismatchOnly, setMismatchOnly] = useState(false);
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [tx, setTx] = useState<Record<string, unknown> | null>(null);
  const [ex, setEx] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const q = { tenantId: tenantId ?? undefined, branchId: branchId ?? undefined, startDate, endDate };

  const load = () => {
    const token = getStoredToken();
    if (!token) {
      return;
    }
    setLoading(true);
    setErr(null);
    Promise.all([
      reconciliationOverview(token, q),
      reconciliationTransactions(token, { ...q, page: 1, pageSize: 25, mismatchOnly }),
      reconciliationExceptions(token, q),
    ])
      .then(([o, t, e]) => {
        setOverview(isRecord(o) ? o : null);
        setTx(isRecord(t) ? t : null);
        setEx(isRecord(e) ? e : null);
      })
      .catch((e) => {
        setErr(e instanceof ApiError ? e.message : 'Failed to load reconciliation');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!scopeLoading) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, branchId, scopeLoading, mismatchOnly, startDate, endDate]);

  const counts = overview?.counts && isRecord(overview.counts) ? overview.counts : null;
  const txItems = Array.isArray(tx?.items) ? (tx.items as Record<string, unknown>[]) : [];

  const stale = Array.isArray(ex?.stalePending) ? (ex!.stalePending as Record<string, unknown>[]) : [];
  const failed = Array.isArray(ex?.failed) ? (ex!.failed as Record<string, unknown>[]) : [];
  const mismatchRows = Array.isArray(ex?.providerLocalMismatch)
    ? (ex!.providerLocalMismatch as Record<string, unknown>[])
    : [];

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="Ledger integrity"
        title="Reconciliation"
        description="Drift, stale pendings, and finance exceptions."
        action={
          <FilterBar className="!p-3">
            <div className="space-y-1">
              <Label htmlFor="r-start">From</Label>
              <Input
                id="r-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 w-[9.5rem]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-end">To</Label>
              <Input id="r-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 w-[9.5rem]" />
            </div>
            <label className="flex cursor-pointer items-center gap-2 pt-6 text-sm text-smoke-300">
              <input
                type="checkbox"
                checked={mismatchOnly}
                onChange={(e) => setMismatchOnly(e.target.checked)}
                className="h-4 w-4 rounded border-smoke-400/30"
              />
              Drift only
            </label>
            <div className="flex items-end">
              <Button type="button" onClick={load} disabled={loading} className="h-10 rounded-full px-5">
                {loading ? 'Loading…' : 'Refresh'}
              </Button>
            </div>
          </FilterBar>
        }
      />

      {!tenantId ? (
        <EmptyState
          variant="premium"
          icon="fluent-color:building-store-24"
          title="Pick a business"
          description="Choose a business to open reconciliation."
        />
      ) : null}

      {err ? (
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-5 py-4 text-sm text-rose-900">{err}</div>
      ) : null}

      {tenantId && counts ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricMini
            icon="fluent-color:alert-24"
            label="Status drift"
            value={counts.providerLocalStatusMismatch != null ? String(counts.providerLocalStatusMismatch) : '—'}
            hint="Provider vs local"
          />
          <MetricMini
            icon="fluent-color:alert-urgent-24"
            label="Terminal drift"
            value={counts.pendingButProviderSuggestsTerminal != null ? String(counts.pendingButProviderSuggestsTerminal) : '—'}
          />
          <MetricMini
            icon="fluent-color:calendar-data-bar-24"
            label="Stale pending"
            value={counts.stalePending != null ? String(counts.stalePending) : '—'}
          />
          <MetricMini icon="fluent-color:apps-list-detail-32" label="Transactions" value={String(counts.transactionsInPeriod ?? '—')} />
          <MetricMini icon="fluent-color:alert-urgent-24" label="Failed" value={String(counts.failed ?? '—')} />
          <MetricMini
            icon="fluent-color:contact-card-48"
            label="Payout pending"
            value={String(counts.payoutPendingQueue ?? '—')}
          />
        </motion.div>
      ) : null}

      {tenantId && txItems.length > 0 ? (
        <ChartCard
          title="Transaction review"
          description={mismatchOnly ? 'Drift rows only.' : 'Latest rows in scope.'}
          contentClassName="px-0 pb-0"
        >
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Local status</Th>
                  <Th>Provider</Th>
                  <Th>Drift</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Updated</Th>
                </tr>
              </thead>
              <tbody>
                {txItems.map((r) => (
                  <tr
                    key={String(r.id)}
                    className={r.mismatch === true ? 'bg-amber-500/[0.06]' : 'hover:bg-smoke-400/[0.02]'}
                  >
                    <Td>
                      <StatusChip status={String(r.status ?? '—')} />
                    </Td>
                    <Td className="max-w-[120px] truncate text-xs text-smoke-200">
                      {String(r.lastProviderStatus ?? '—')}
                    </Td>
                    <Td>
                      {r.mismatch === true ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950">
                          <Icon icon="fluent-color:alert-24" className="h-3.5 w-3.5" aria-hidden />
                          Drift
                        </span>
                      ) : (
                        <span className="text-xs text-smoke-200">—</span>
                      )}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {formatMinorUnits(typeof r.amountCents === 'number' ? r.amountCents : Number(r.amountCents))}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-smoke-200">
                      {r.updatedAt ? new Date(String(r.updatedAt)).toLocaleString() : '—'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </ChartCard>
      ) : tenantId && !loading ? (
        <div className="rounded-2xl border border-dashed border-smoke-400/20 px-6 py-10 text-center text-sm text-smoke-200">
          No rows for this filter.
        </div>
      ) : null}

      {tenantId ? (
        <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard title="Stale pending" description="Oldest stuck rows.">
          {stale.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-smoke-200">None.</p>
          ) : (
            <ul className="space-y-2 px-6 pb-6">
              {stale.slice(0, 6).map((row) => (
                <li
                  key={String(row.id)}
                  className="rounded-xl border border-smoke-400/8 bg-ivory-100/60 px-3 py-2 text-xs text-smoke-300"
                >
                  <span className="font-mono text-smoke-400">{String(row.orderReference ?? row.id)}</span>
                  <span className="mt-1 block text-smoke-200">
                    {formatMinorUnits(Number(row.amountCents))} · {String(row.type ?? '')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
        <ChartCard title="Failed rows" description="Recent failures.">
          {failed.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-smoke-200">None.</p>
          ) : (
            <ul className="space-y-2 px-6 pb-6">
              {failed.slice(0, 6).map((row) => (
                <li
                  key={String(row.id)}
                  className="rounded-xl border border-rose-500/15 bg-rose-500/[0.04] px-3 py-2 text-xs text-smoke-300"
                >
                  <span className="font-mono text-smoke-400">{String(row.orderReference ?? row.id)}</span>
                  <span className="mt-1 block text-rose-900/80">
                    {formatMinorUnits(Number(row.amountCents))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
        <ChartCard title="Provider ↔ local" description="Status drift sample.">
          {mismatchRows.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-smoke-200">No drift.</p>
          ) : (
            <ul className="space-y-2 px-6 pb-6">
              {mismatchRows.slice(0, 6).map((row) => (
                <li
                  key={String(row.id)}
                  className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip status={String(row.status ?? '—')} />
                    <span className="text-smoke-200">vs</span>
                    <span className="font-mono text-smoke-300">{String(row.lastProviderStatus ?? '—')}</span>
                  </div>
                  <span className="mt-1 block font-mono text-smoke-400">{String(row.orderReference ?? row.id)}</span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>
      ) : null}
    </div>
  );
}
