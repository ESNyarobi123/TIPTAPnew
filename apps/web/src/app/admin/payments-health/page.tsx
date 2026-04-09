'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AttentionPanel, type AttentionItem } from '@/components/workspace/attention-panel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { KeyValueList } from '@/components/ui/key-value-list';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { StatusChip } from '@/components/ui/status-chip';
import { Table, Td, Th } from '@/components/ui/table';
import { paymentsDashboardSummary, paymentsReconciliationFlags } from '@/lib/api/payments-dashboard';
import { ApiError } from '@/lib/api/client';
import { getStoredToken } from '@/lib/auth/storage';
import { formatMinorUnits } from '@/lib/format';
import { toast } from '@/lib/toast';

type Summary = {
  period?: { start?: string; end?: string };
  scope?: { allTenants?: boolean };
  configHealth?: {
    tenantId?: string | null;
    note?: string;
    providers?: { provider?: string; isActive?: boolean; lastWebhookAt?: string | null }[];
  };
  payments?: {
    byStatus?: { status: string; count: number; amountCents: number }[];
    byType?: { type: string; count: number; amountCents: number }[];
  };
  reconciliationPreview?: {
    stalePendingCount?: number;
    failedLast7DaysCount?: number;
  };
};

type FlagsPayload = {
  counts?: {
    pendingTotal?: number;
    payoutPendingTotal?: number;
    stalePendingSampleSize?: number;
    failedRecentSampleSize?: number;
    manualReviewQueueApprox?: number;
  };
  flags?: {
    hasStalePending?: boolean;
    hasRecentFailures?: boolean;
    webhookPossiblyStale?: boolean;
  };
  samples?: {
    stalePending?: { id?: string; orderReference?: string; updatedAt?: string }[];
    failedRecent?: { id?: string; orderReference?: string; updatedAt?: string }[];
  };
};

export default function AdminPaymentsHealthPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [flags, setFlags] = useState<FlagsPayload | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([paymentsDashboardSummary(token, {}), paymentsReconciliationFlags(token, {})])
      .then(([s, f]) => {
        setSummary((s ?? null) as Summary);
        setFlags((f ?? null) as FlagsPayload);
      })
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load payment health'))
      .finally(() => setLoading(false));
  }, []);

  if (!getStoredToken()) {
    return (
      <EmptyState
        variant="premium"
        icon="ph:lock-key-duotone"
        title="Sign in required"
        description="Sign in to review platform payment health."
      />
    );
  }

  const completed = summary?.payments?.byStatus?.find((x) => x.status === 'COMPLETED');
  const pending = summary?.payments?.byStatus?.find((x) => x.status === 'PENDING');
  const failed = summary?.payments?.byStatus?.find((x) => x.status === 'FAILED');

  const attention: AttentionItem[] = [];
  if (flags?.flags?.webhookPossiblyStale) {
    attention.push({
      id: 'wh',
      severity: 'warning',
      title: 'Webhook heartbeat risk',
      detail: 'Pending volume with stale or missing provider webhook signals.',
      href: '/admin/reconciliation',
    });
  }
  if (flags?.flags?.hasStalePending) {
    attention.push({
      id: 'st',
      severity: 'warning',
      title: 'Stale pending sample in queue',
      detail: `${flags.counts?.stalePendingSampleSize ?? 0} sampled rows aged beyond threshold.`,
      href: '/admin/reconciliation',
    });
  }
  if (flags?.flags?.hasRecentFailures) {
    attention.push({
      id: 'fl',
      severity: 'critical',
      title: 'Recent failures in sample',
      detail: 'Review failure rows for gateway or instrument issues.',
      href: '/admin/reconciliation',
    });
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="platform"
        eyebrow="Platform finance"
        title="Payment health"
        description="Cross-tenant payment velocity, status distribution, and webhook heuristics — structured for triage, not raw dumps."
        action={
          <Link
            href="/admin/reconciliation"
            className="inline-flex items-center gap-2 rounded-xl border border-smoke-400/12 bg-ivory-50 px-4 py-2.5 text-sm font-medium text-smoke-400 shadow-soft transition hover:border-smoke-400/20 hover:shadow-card"
          >
            <Icon icon="ph:scales-duotone" className="h-5 w-5" aria-hidden />
            Reconciliation
          </Link>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-12">
            <motion.div className="md:col-span-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AttentionPanel
                title="Signals"
                subtitle="Heuristics from the payments reconciliation service"
                items={attention}
                emptyHint="No payment health warnings surfaced in this pass — continue monitoring as volumes grow."
              />
            </motion.div>
            <motion.div className="md:col-span-7" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-smoke-400/10 shadow-card">
                <CardHeader>
                  <CardTitle className="text-base">Queue approximates</CardTitle>
                </CardHeader>
                <CardContent>
                  <KeyValueList
                    rows={[
                      {
                        label: 'Manual review queue (approx.)',
                        value: flags?.counts?.manualReviewQueueApprox ?? '—',
                      },
                      {
                        label: 'Pending total',
                        value: flags?.counts?.pendingTotal ?? '—',
                      },
                      {
                        label: 'Payout pending',
                        value: flags?.counts?.payoutPendingTotal ?? '—',
                      },
                      {
                        label: 'Stale pending sample size',
                        value: flags?.counts?.stalePendingSampleSize ?? '—',
                      },
                      {
                        label: 'Failed (recent sample)',
                        value: flags?.counts?.failedRecentSampleSize ?? '—',
                      },
                    ]}
                  />
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon="ph:currency-circle-dollar-duotone"
              label="Completed volume"
              value={formatMinorUnits(completed?.amountCents ?? 0)}
              hint="In default dashboard scope"
            />
            <StatCard icon="ph:hourglass-duotone" label="Pending count" value={pending?.count ?? 0} />
            <StatCard icon="ph:warning-octagon-duotone" label="Failed count" value={failed?.count ?? 0} />
            <StatCard
              icon="ph:clock-counter-clockwise-duotone"
              label="Stale pending (preview)"
              value={summary?.reconciliationPreview?.stalePendingCount ?? '—'}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-smoke-400/10 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base">Status distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {(summary?.payments?.byStatus?.length ?? 0) === 0 ? (
                  <p className="text-sm text-smoke-200">No payment rows in the resolved scope window.</p>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <Th>Status</Th>
                        <Th>Count</Th>
                        <Th className="text-right">Amount</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary?.payments?.byStatus?.map((r) => (
                        <tr key={r.status}>
                          <Td>
                            <StatusChip status={r.status} />
                          </Td>
                          <Td className="tabular-nums">{r.count}</Td>
                          <Td className="text-right font-medium tabular-nums text-smoke-400">
                            {formatMinorUnits(r.amountCents)}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="border-smoke-400/10 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base">Type distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {(summary?.payments?.byType?.length ?? 0) === 0 ? (
                  <p className="text-sm text-smoke-200">No type groups for this scope.</p>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <Th>Type</Th>
                        <Th>Count</Th>
                        <Th className="text-right">Amount</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary?.payments?.byType?.map((r) => (
                        <tr key={r.type}>
                          <Td className="font-medium text-smoke-400">{r.type}</Td>
                          <Td className="tabular-nums">{r.count}</Td>
                          <Td className="text-right tabular-nums text-smoke-400">
                            {formatMinorUnits(r.amountCents)}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-smoke-400/10 bg-violet-50/25 shadow-soft ring-1 ring-violet-200/25">
            <CardHeader>
              <CardTitle className="text-base">Provider configuration note</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-smoke-200">
              <p>
                {summary?.configHealth?.note ??
                  'Per-tenant provider health requires a single tenant scope from this endpoint.'}
              </p>
              {summary?.configHealth?.providers && summary.configHealth.providers.length > 0 ? (
                <ul className="space-y-2">
                  {summary.configHealth.providers.map((p, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-smoke-400/[0.08] bg-ivory-100/80 px-3 py-2"
                    >
                      <span className="font-medium text-smoke-400">{p.provider ?? 'Provider'}</span>
                      <span className="text-xs text-smoke-200">
                        {p.lastWebhookAt
                          ? `Last webhook ${new Date(p.lastWebhookAt).toLocaleString()}`
                          : 'No webhook timestamp'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>

          {(flags?.samples?.stalePending?.length || flags?.samples?.failedRecent?.length) ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {flags?.samples?.stalePending && flags.samples.stalePending.length > 0 ? (
                <Card className="border-smoke-400/10">
                  <CardHeader>
                    <CardTitle className="text-base">Stale pending sample</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <thead>
                        <tr>
                          <Th>Reference</Th>
                          <Th>Updated</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {flags.samples.stalePending.slice(0, 8).map((r) => (
                          <tr key={String(r.id)}>
                            <Td className="max-w-[180px] truncate text-xs">{String(r.orderReference ?? r.id)}</Td>
                            <Td className="whitespace-nowrap text-xs text-smoke-200">
                              {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </CardContent>
                </Card>
              ) : null}
              {flags?.samples?.failedRecent && flags.samples.failedRecent.length > 0 ? (
                <Card className="border-smoke-400/10">
                  <CardHeader>
                    <CardTitle className="text-base">Recent failures sample</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <thead>
                        <tr>
                          <Th>Reference</Th>
                          <Th>Updated</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {flags.samples.failedRecent.slice(0, 8).map((r) => (
                          <tr key={String(r.id)}>
                            <Td className="max-w-[180px] truncate text-xs">{String(r.orderReference ?? r.id)}</Td>
                            <Td className="whitespace-nowrap text-xs text-smoke-200">
                              {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
