'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { KeyValueList } from '@/components/ui/key-value-list';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { Table, Td, Th } from '@/components/ui/table';
import { reconciliationOverview, reconciliationExceptions } from '@/lib/api/reconciliation';
import { ApiError } from '@/lib/api/client';
import { getStoredToken } from '@/lib/auth/storage';
import { formatMinorUnits } from '@/lib/format';
import { toast } from '@/lib/toast';

type Overview = {
  period?: { start?: string; end?: string };
  counts?: {
    transactionsInPeriod?: number;
    providerLocalStatusMismatch?: number;
    pendingButProviderSuggestsTerminal?: number;
    stalePending?: number;
    failed?: number;
    payoutPendingQueue?: number;
  };
};

type ExceptionRow = {
  id?: string;
  orderReference?: string | null;
  type?: string;
  status?: string;
  amountCents?: number;
  lastProviderStatus?: string | null;
  updatedAt?: string;
};

type ExceptionsPayload = {
  exceptionQueueApprox?: number;
  stalePending?: ExceptionRow[];
  failed?: ExceptionRow[];
  providerLocalMismatch?: ExceptionRow[];
};

function MiniTable({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: ExceptionRow[];
  empty: string;
}) {
  return (
    <Card className="border-smoke-400/10 shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-smoke-200">{empty}</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th className="text-right">Amount</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 12).map((r) => (
                <tr key={String(r.id)}>
                  <Td className="max-w-[140px] truncate text-xs font-medium">
                    {String(r.orderReference ?? r.id ?? '—')}
                  </Td>
                  <Td className="text-xs">{r.type ?? '—'}</Td>
                  <Td className="text-xs">{r.status ?? '—'}</Td>
                  <Td className="text-right text-xs tabular-nums">
                    {formatMinorUnits(r.amountCents ?? 0)}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-smoke-200">
                    {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminReconciliationPage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [exceptions, setExceptions] = useState<ExceptionsPayload | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([reconciliationOverview(token, {}), reconciliationExceptions(token, {})])
      .then(([o, e]) => {
        setOverview((o ?? null) as Overview);
        setExceptions((e ?? null) as ExceptionsPayload);
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load reconciliation'))
      .finally(() => setLoading(false));
  }, []);

  if (!getStoredToken()) {
    return (
      <EmptyState
        variant="premium"
        icon="ph:lock-key-duotone"
        title="Sign in required"
        description="Sign in to access platform reconciliation."
      />
    );
  }

  const c = overview?.counts;

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="platform"
        eyebrow="Ledger discipline"
        title="Reconciliation"
        description="Platform-wide payment integrity: mismatches, stale pendings, and failure samples — presented for operator triage. Read-only in v1."
        action={
          <Link
            href="/admin/payments-health"
            className="inline-flex items-center gap-2 rounded-xl border border-smoke-400/12 bg-ivory-50 px-4 py-2.5 text-sm font-medium text-smoke-400 shadow-soft transition hover:border-smoke-400/20 hover:shadow-card"
          >
            <Icon icon="ph:heartbeat-duotone" className="h-5 w-5" aria-hidden />
            Payment health
          </Link>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon="ph:scales-duotone"
              label="Provider ↔ local mismatch"
              value={c?.providerLocalStatusMismatch ?? 0}
            />
            <StatCard
              icon="ph:arrows-split-duotone"
              label="Pending vs provider terminal"
              value={c?.pendingButProviderSuggestsTerminal ?? 0}
            />
            <StatCard icon="ph:clock-duotone" label="Stale pending" value={c?.stalePending ?? 0} />
            <StatCard icon="ph:queue-duotone" label="Payout queue" value={c?.payoutPendingQueue ?? 0} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-smoke-400/10 shadow-card">
                <CardHeader>
                  <CardTitle className="text-base">Period summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <KeyValueList
                    rows={[
                      {
                        label: 'Window',
                        value: `${overview?.period?.start?.slice(0, 10) ?? '—'} → ${overview?.period?.end?.slice(0, 10) ?? '—'}`,
                      },
                      {
                        label: 'Transactions in scope',
                        value: c?.transactionsInPeriod ?? '—',
                      },
                      { label: 'Failed (raw count)', value: c?.failed ?? '—' },
                      {
                        label: 'Exception queue (approx.)',
                        value: exceptions?.exceptionQueueApprox ?? '—',
                        hint: 'Sum of sampled stale, failed, and mismatch rows',
                      },
                    ]}
                  />
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
              <Card className="h-full border-amber-900/10 bg-amber-50/25 shadow-soft">
                <CardContent className="p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-950/70">Operator note</p>
                  <p className="mt-2 text-sm leading-relaxed text-smoke-200">
                    Drill into merchant reconciliation from a tenant login when you need branch-scoped filters. This
                    view prioritizes platform posture.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <MiniTable
              title="Stale pending sample"
              rows={exceptions?.stalePending ?? []}
              empty="No stale pending rows sampled."
            />
            <MiniTable title="Failed sample" rows={exceptions?.failed ?? []} empty="No failed rows in sample." />
            <MiniTable
              title="Provider mismatch sample"
              rows={exceptions?.providerLocalMismatch ?? []}
              empty="No mismatches in sample."
            />
          </div>
        </>
      )}
    </div>
  );
}
