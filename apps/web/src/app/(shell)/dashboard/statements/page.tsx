'use client';

import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChartCard } from '@/components/ui/chart-card';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MetricMini } from '@/components/ui/metric-mini';
import { SectionHeader } from '@/components/ui/section-header';
import { Select } from '@/components/ui/select';
import { Table, Td, Th } from '@/components/ui/table';
import { ApiError } from '@/lib/api/client';
import { getStatement } from '@/lib/api/statements';
import { defaultDateRange, formatMinorUnits } from '@/lib/format';
import { getStoredToken } from '@/lib/auth/storage';
import { useScope } from '@/providers/scope-provider';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export default function StatementsPage() {
  const { tenantId, branchId, branches, loading: scopeLoading } = useScope();
  const def = defaultDateRange();
  const [startDate, setStartDate] = useState(def.startDate);
  const [endDate, setEndDate] = useState(def.endDate);
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? id.slice(0, 8) + '…';

  const load = () => {
    const token = getStoredToken();
    if (!token || !tenantId) {
      return;
    }
    setLoading(true);
    setErr(null);
    getStatement(token, {
      tenantId,
      branchId: branchFilter || branchId || undefined,
      startDate,
      endDate,
    })
      .then((r) => setData(isRecord(r) ? r : null))
      .catch((e) => {
        setErr(e instanceof ApiError ? e.message : 'Failed to load statement');
        setData(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tenantId && !scopeLoading) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, scopeLoading]);

  const period = data?.period && isRecord(data.period) ? data.period : null;
  const totals = data?.totals && isRecord(data.totals) ? data.totals : null;
  const settlement = data?.settlementVisibility && isRecord(data.settlementVisibility) ? data.settlementVisibility : null;
  const payouts = Array.isArray(settlement?.payoutStatusBreakdown) ? settlement.payoutStatusBreakdown : [];
  const payBreak = Array.isArray(data?.paymentBreakdown) ? data.paymentBreakdown : [];
  const tipBreak = Array.isArray(data?.tipBreakdown) ? data.tipBreakdown : [];
  const byBranch = Array.isArray(data?.byBranch) ? data.byBranch : [];

  const num = (k: string) => (totals && typeof totals[k] === 'number' ? totals[k] : 0);

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="Finance"
        title="Statements"
        description="Period totals, tips, payouts, and branch splits."
        action={
          <FilterBar className="!p-3">
            <div className="space-y-1">
              <Label htmlFor="s-start">From</Label>
              <Input
                id="s-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 w-[9.5rem]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-end">To</Label>
              <Input
                id="s-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 w-[9.5rem]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-branch">Branch</Label>
              <Select
                id="s-branch"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-10 min-w-[10rem] text-sm"
              >
                <option value="">Top bar scope</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name ?? b.id}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={load} disabled={loading || !tenantId} className="h-10">
                {loading ? 'Refreshing…' : 'Apply'}
              </Button>
            </div>
          </FilterBar>
        }
      />

      <Alert variant="warning" title="Read first">
        Figures come from TIPTAP ledger. Confirm provider totals before closing books.
      </Alert>

      {!tenantId ? (
        <EmptyState
          variant="premium"
          icon="fluent-color:building-store-24"
          title="Pick a business"
          description="Choose a business to load statements."
        />
      ) : null}

      {err ? (
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-5 py-4 text-sm text-rose-900">{err}</div>
      ) : null}

      {data && period ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div className="flex flex-col gap-4 rounded-[1.6rem] border border-smoke-400/10 bg-[linear-gradient(135deg,rgba(255,253,248,0.98),rgba(240,235,223,0.92))] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Statement period</p>
              <p className="mt-1 font-display text-lg font-semibold text-smoke-400">
                {new Date(String(period.start)).toLocaleDateString()} —{' '}
                {new Date(String(period.end)).toLocaleDateString()}
              </p>
              <p className="mt-1 text-xs text-smoke-200">
                Generated {data.generatedAt ? new Date(String(data.generatedAt)).toLocaleString() : '—'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 rounded-full"
                onClick={() => {
                  if (data.statementKey) {
                    void navigator.clipboard.writeText(String(data.statementKey));
                  }
                }}
              >
                <Icon icon="fluent-color:apps-list-detail-32" className="h-4 w-4" aria-hidden />
                Copy statement key
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled className="rounded-full opacity-60">
                Export PDF (soon)
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricMini
              icon="fluent-color:coin-multiple-48"
              label="Collections"
              value={formatMinorUnits(num('collectionsCompletedCents'))}
            />
            <MetricMini
              icon="fluent-color:contact-card-48"
              label="Payouts"
              value={formatMinorUnits(num('payoutsCompletedCents'))}
            />
            <MetricMini
              icon="fluent-color:gift-card-24"
              label="Digital tips"
              value={formatMinorUnits(num('digitalTipPaymentCompletedCents'))}
            />
            <MetricMini
              icon="fluent-color:data-trending-48"
              label="Net movement"
              value={formatMinorUnits(num('netMovementApproxCents'))}
              hint="Approx."
            />
            <MetricMini
              icon="fluent-color:person-feedback-48"
              label="Cash tips"
              value={formatMinorUnits(num('cashTipsRecordedCents'))}
            />
            <MetricMini
              icon="fluent-color:alert-urgent-24"
              label="Failed / refunded"
              value={`${num('failedPaymentTransactions')} / ${num('refundedPaymentTransactions')}`}
              hint="In period"
            />
          </div>

          {payouts.length > 0 ? (
            <ChartCard title="Payout status" description="Settlement snapshot.">
              <div className="overflow-x-auto px-2 pb-6">
                <Table>
                  <thead>
                    <tr>
                      <Th>Status</Th>
                      <Th className="text-right">Count</Th>
                      <Th className="text-right">Amount</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payouts as { status: string; count: number; amountCents: number }[]).map((p) => (
                      <tr key={p.status}>
                        <Td className="font-medium">{p.status.replace(/_/g, ' ')}</Td>
                        <Td className="text-right tabular-nums">{p.count}</Td>
                        <Td className="text-right tabular-nums">{formatMinorUnits(p.amountCents)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </ChartCard>
          ) : null}

          {payBreak.length > 0 ? (
            <ChartCard title="Payment split">
              <div className="overflow-x-auto px-2 pb-6">
                <Table>
                  <thead>
                    <tr>
                      <Th>Type</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Count</Th>
                      <Th className="text-right">Amount</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payBreak as { type: string; status: string; count: number; amountCents: number }[]).map(
                      (row, i) => (
                        <tr key={`${row.type}-${row.status}-${i}`}>
                          <Td className="font-medium">{row.type.replace(/_/g, ' ')}</Td>
                          <Td>{row.status.replace(/_/g, ' ')}</Td>
                          <Td className="text-right tabular-nums">{row.count}</Td>
                          <Td className="text-right tabular-nums">{formatMinorUnits(row.amountCents)}</Td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </Table>
              </div>
            </ChartCard>
          ) : null}

          {tipBreak.length > 0 ? (
            <ChartCard title="Tip split">
              <div className="overflow-x-auto px-2 pb-6">
                <Table>
                  <thead>
                    <tr>
                      <Th>Mode</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Count</Th>
                      <Th className="text-right">Amount</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tipBreak as { mode: string; status: string; count: number; amountCents: number }[]).map(
                      (row, i) => (
                        <tr key={`${row.mode}-${row.status}-${i}`}>
                          <Td className="font-medium">{row.mode}</Td>
                          <Td>{row.status.replace(/_/g, ' ')}</Td>
                          <Td className="text-right tabular-nums">{row.count}</Td>
                          <Td className="text-right tabular-nums">{formatMinorUnits(row.amountCents)}</Td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </Table>
              </div>
            </ChartCard>
          ) : null}

          {byBranch.length > 0 ? (
            <ChartCard title="By branch" description="Branch-level split.">
              <div className="overflow-x-auto px-2 pb-6">
                <Table>
                  <thead>
                    <tr>
                      <Th>Branch</Th>
                      <Th>Type</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Count</Th>
                      <Th className="text-right">Amount</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      byBranch as {
                        branchId: string;
                        type: string;
                        status: string;
                        count: number;
                        amountCents: number;
                      }[]
                    ).map((row, i) => (
                      <tr key={`${row.branchId}-${row.type}-${row.status}-${i}`}>
                        <Td className="font-medium">{branchName(row.branchId)}</Td>
                        <Td>{row.type.replace(/_/g, ' ')}</Td>
                        <Td>{row.status.replace(/_/g, ' ')}</Td>
                        <Td className="text-right tabular-nums">{row.count}</Td>
                        <Td className="text-right tabular-nums">{formatMinorUnits(row.amountCents)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </ChartCard>
          ) : null}
        </motion.div>
      ) : null}
    </div>
  );
}
