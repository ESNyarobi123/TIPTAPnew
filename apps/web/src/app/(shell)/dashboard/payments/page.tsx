'use client';

import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ChartCard } from '@/components/ui/chart-card';
import { MetricMini } from '@/components/ui/metric-mini';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusChip } from '@/components/ui/status-chip';
import { Table, Td, Th } from '@/components/ui/table';
import { ApiError } from '@/lib/api/client';
import {
  paymentsConfigHealth,
  paymentsDashboardSummary,
  paymentsRecentTransactions,
  paymentsReconciliationFlags,
} from '@/lib/api/payments-dashboard';
import { formatMinorUnits } from '@/lib/format';
import { getStoredToken } from '@/lib/auth/storage';
import { useScope } from '@/providers/scope-provider';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export default function PaymentsDashboardPage() {
  const { tenantId, branchId, loading: scopeLoading } = useScope();
  const [summary, setSummary] = useState<unknown>(null);
  const [health, setHealth] = useState<unknown>(null);
  const [recent, setRecent] = useState<unknown>(null);
  const [flags, setFlags] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token || scopeLoading || !tenantId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    const q = { tenantId, branchId: branchId ?? undefined };
    Promise.all([
      paymentsDashboardSummary(token, q),
      paymentsConfigHealth(token, { tenantId, branchId: branchId ?? undefined }),
      paymentsRecentTransactions(token, { ...q, page: 1, pageSize: 20 }),
      paymentsReconciliationFlags(token, q),
    ])
      .then(([s, h, r, f]) => {
        if (!cancelled) {
          setSummary(s);
          setHealth(h);
          setRecent(r);
          setFlags(f);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setErr(e instanceof ApiError ? e.message : 'Failed to load payments data');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, branchId, scopeLoading]);

  const rows =
    recent &&
    typeof recent === 'object' &&
    'items' in recent &&
    Array.isArray((recent as { items: unknown }).items)
      ? (recent as { items: Record<string, unknown>[] }).items
      : [];

  const sumRec = summary && isRecord(summary) ? summary : null;
  const payBlock =
    sumRec?.payments && isRecord(sumRec.payments) ? (sumRec.payments as Record<string, unknown>) : null;
  const byStatus = Array.isArray(payBlock?.byStatus)
    ? (payBlock.byStatus as { status: string; count: number; amountCents: number }[])
    : [];
  const byType = Array.isArray(payBlock?.byType)
    ? (payBlock.byType as { type: string; count: number; amountCents: number }[])
    : [];

  const recon =
    sumRec?.reconciliationPreview && isRecord(sumRec.reconciliationPreview)
      ? sumRec.reconciliationPreview
      : null;
  const stalePrev = typeof recon?.stalePendingCount === 'number' ? recon.stalePendingCount : 0;
  const failPrev = typeof recon?.failedLast7DaysCount === 'number' ? recon.failedLast7DaysCount : 0;

  const healthRec = health && isRecord(health) ? health : null;
  const providers = Array.isArray(healthRec?.providers) ? (healthRec.providers as Record<string, unknown>[]) : [];
  const healthNote = typeof healthRec?.note === 'string' ? healthRec.note : null;

  const flagsRec = flags && isRecord(flags) ? flags : null;
  const counts = flagsRec?.counts && isRecord(flagsRec.counts) ? flagsRec.counts : null;
  const flagBits = flagsRec?.flags && isRecord(flagsRec.flags) ? flagsRec.flags : null;
  const samples = flagsRec?.samples && isRecord(flagsRec.samples) ? flagsRec.samples : null;
  const staleSample = Array.isArray(samples?.stalePending) ? samples.stalePending : [];
  const failedSample = Array.isArray(samples?.failedRecent) ? samples.failedRecent : [];

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="Ledger"
        title="Payments"
        description="Trust-oriented view of throughput, provider health, live activity, and reconciliation signals — without leaving the ivory workspace."
      />

      {!tenantId && !scopeLoading ? (
        <div className="rounded-2xl border border-dashed border-smoke-400/20 bg-ivory-50/80 px-5 py-8 text-center text-sm text-smoke-200">
          Select a tenant to load payment intelligence.
        </div>
      ) : null}

      {err ? (
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-5 py-4 text-sm text-rose-900">{err}</div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl md:col-span-2" />
        </div>
      ) : null}

      {!loading && byStatus.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {byStatus.map((s) => (
            <MetricMini
              key={s.status}
              icon="ph:receipt-duotone"
              label={s.status.replace(/_/g, ' ')}
              value={formatMinorUnits(s.amountCents)}
              hint={`${s.count} transactions`}
            />
          ))}
        </div>
      ) : null}

      {!loading && (stalePrev > 0 || failPrev > 0) ? (
        <div className="grid gap-4 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-5"
          >
            <div className="flex items-center gap-2 text-amber-950">
              <Icon icon="ph:clock-counter-clockwise-duotone" className="h-6 w-6" aria-hidden />
              <p className="font-display font-semibold">Stale pending (heuristic)</p>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-amber-950">{stalePrev}</p>
            <p className="mt-1 text-xs text-amber-950/80">Rows pending longer than configured staleness.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-5"
          >
            <div className="flex items-center gap-2 text-rose-950">
              <Icon icon="ph:warning-circle-duotone" className="h-6 w-6" aria-hidden />
              <p className="font-display font-semibold">Failed (7 days)</p>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-rose-950">{failPrev}</p>
            <p className="mt-1 text-xs text-rose-950/80">Surface for quick triage alongside reconciliation.</p>
          </motion.div>
        </div>
      ) : null}

      {!loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Provider configuration"
            description={healthNote ?? 'Masked credentials — webhook and capability flags only.'}
          >
            {providers.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-smoke-200">
                {healthNote ||
                  'No provider rows for this tenant yet. Add ClickPesa configuration under Settings → Payment provider.'}
              </p>
            ) : (
              <div className="space-y-3 px-6 pb-6">
                {providers.map((p) => (
                  <motion.div
                    key={String(p.id)}
                    whileHover={{ scale: 1.01 }}
                    className="rounded-xl border border-smoke-400/10 bg-ivory-100/80 p-4 shadow-soft"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-smoke-400">{String(p.displayName ?? p.provider ?? 'Provider')}</p>
                        <p className="text-xs text-smoke-200">{String(p.provider ?? '')}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {p.isActive === true ? <StatusChip status="ACTIVE" /> : <StatusChip status="INACTIVE" />}
                        {p.collectionEnabled === true ? (
                          <span className="rounded-full bg-smoke-400/8 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-smoke-300">
                            Collect
                          </span>
                        ) : null}
                        {p.payoutEnabled === true ? (
                          <span className="rounded-full bg-smoke-400/8 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-smoke-300">
                            Payout
                          </span>
                        ) : null}
                        {p.webhookConfigured === true ? (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-900">
                            Webhook
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-medium text-amber-950">
                            No webhook secret
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-smoke-200">
                      Last webhook:{' '}
                      {p.lastWebhookAt
                        ? new Date(String(p.lastWebhookAt)).toLocaleString()
                        : '— never recorded'}
                    </p>
                  </motion.div>
                ))}
              </div>
            )}
          </ChartCard>

          <ChartCard title="Reconciliation flags" description="Live heuristics from the payments dashboard API.">
            <div className="grid gap-3 px-6 pb-6 sm:grid-cols-2">
              <MetricMini
                icon="ph:hourglass-duotone"
                label="Pending total"
                value={counts?.pendingTotal != null ? String(counts.pendingTotal) : '—'}
              />
              <MetricMini
                icon="ph:hand-arrow-down-duotone"
                label="Payout pending"
                value={counts?.payoutPendingTotal != null ? String(counts.payoutPendingTotal) : '—'}
              />
              <MetricMini
                icon="ph:queue-duotone"
                label="Review queue (approx.)"
                value={counts?.manualReviewQueueApprox != null ? String(counts.manualReviewQueueApprox) : '—'}
              />
              <div className="rounded-xl border border-smoke-400/10 bg-smoke-400/[0.04] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Signals</p>
                <ul className="mt-2 space-y-2 text-sm">
                  <li className="flex items-center justify-between gap-2">
                    <span className="text-smoke-200">Stale pending sample</span>
                    <span className="font-medium tabular-nums text-smoke-400">
                      {counts?.stalePendingSampleSize != null ? String(counts.stalePendingSampleSize) : '—'}
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span className="text-smoke-200">Recent failures sample</span>
                    <span className="font-medium tabular-nums text-smoke-400">
                      {counts?.failedRecentSampleSize != null ? String(counts.failedRecentSampleSize) : '—'}
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span className="text-smoke-200">Webhook possibly stale</span>
                    <span className="font-medium text-smoke-400">
                      {flagBits?.webhookPossiblyStale === true ? 'Yes' : 'No'}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </ChartCard>
        </div>
      ) : null}

      {!loading && (staleSample.length > 0 || failedSample.length > 0) ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {staleSample.length > 0 ? (
            <ChartCard title="Stale pending sample" description="Oldest stuck rows — investigate with reconciliation.">
              <div className="overflow-x-auto px-2 pb-4">
                <Table>
                  <thead>
                    <tr>
                      <Th>Reference</Th>
                      <Th>Type</Th>
                      <Th className="text-right">Amount</Th>
                      <Th>Updated</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(staleSample as Record<string, unknown>[]).slice(0, 8).map((r) => (
                      <tr key={String(r.id)}>
                        <Td className="max-w-[140px] truncate font-mono text-xs">{String(r.orderReference ?? r.id)}</Td>
                        <Td>{String(r.type ?? '—')}</Td>
                        <Td className="text-right tabular-nums">
                          {formatMinorUnits(Number(r.amountCents))}
                        </Td>
                        <Td className="text-xs text-smoke-200">
                          {r.updatedAt ? new Date(String(r.updatedAt)).toLocaleString() : '—'}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </ChartCard>
          ) : null}
          {failedSample.length > 0 ? (
            <ChartCard title="Recent failures sample" description="Latest failed transactions in scope.">
              <div className="overflow-x-auto px-2 pb-4">
                <Table>
                  <thead>
                    <tr>
                      <Th>Reference</Th>
                      <Th>Provider</Th>
                      <Th className="text-right">Amount</Th>
                      <Th>Updated</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(failedSample as Record<string, unknown>[]).slice(0, 8).map((r) => (
                      <tr key={String(r.id)}>
                        <Td className="max-w-[140px] truncate font-mono text-xs">{String(r.orderReference ?? r.id)}</Td>
                        <Td className="text-xs">{String(r.lastProviderStatus ?? '—')}</Td>
                        <Td className="text-right tabular-nums">
                          {formatMinorUnits(Number(r.amountCents))}
                        </Td>
                        <Td className="text-xs text-smoke-200">
                          {r.updatedAt ? new Date(String(r.updatedAt)).toLocaleString() : '—'}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </ChartCard>
          ) : null}
        </div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <ChartCard
          title="Recent activity"
          description="Latest ledger movements in your current scope."
          contentClassName="px-0 pb-0"
        >
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Status</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Reference</Th>
                  <Th>Updated</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r.id)} className="transition-colors hover:bg-smoke-400/[0.03]">
                    <Td>
                      <StatusChip status={String(r.status ?? '—')} />
                    </Td>
                    <Td className="font-medium">{String(r.type ?? '—').replace(/_/g, ' ')}</Td>
                    <Td className="text-right tabular-nums">
                      {formatMinorUnits(typeof r.amountCents === 'number' ? r.amountCents : Number(r.amountCents))}
                    </Td>
                    <Td className="max-w-[160px] truncate font-mono text-xs text-smoke-200">
                      {String(r.orderReference ?? '—')}
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
      ) : null}

      {!loading && byType.length > 0 ? (
        <ChartCard title="Volume by type" description="Distribution across transaction types for the dashboard window.">
          <div className="overflow-x-auto px-2 pb-6">
            <Table>
              <thead>
                <tr>
                  <Th>Type</Th>
                  <Th className="text-right">Count</Th>
                  <Th className="text-right">Volume</Th>
                </tr>
              </thead>
              <tbody>
                {byType.map((t) => (
                  <tr key={t.type}>
                    <Td className="font-medium">{t.type.replace(/_/g, ' ')}</Td>
                    <Td className="text-right tabular-nums">{t.count}</Td>
                    <Td className="text-right tabular-nums">{formatMinorUnits(t.amountCents)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </ChartCard>
      ) : null}
    </div>
  );
}
