'use client';

import { Icon } from '@iconify/react';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { listMyCompensations, type MyCompensationRow } from '@/lib/api/staff-me';
import { getProviderWorkspace, type ProviderWorkspace } from '@/lib/api/provider-workspace';
import { getStoredToken } from '@/lib/auth/storage';
import { formatMinorUnits } from '@/lib/format';
import { toast } from '@/lib/toast';

export default function ProviderEarningsPage() {
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<ProviderWorkspace | null>(null);
  const [compensations, setCompensations] = useState<MyCompensationRow[]>([]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void Promise.allSettled([
      getProviderWorkspace(token).then((payload) => setWorkspace(payload)),
      listMyCompensations(token).then((payload) => setCompensations(payload.items)),
    ]).then((results) => {
      const ws = results[0];
      const comp = results[1];
      if (ws.status === 'rejected') {
        toast.error('Could not load workspace');
        setWorkspace(null);
      }
      if (comp.status === 'rejected') {
        toast.error('Could not load compensation list');
        setCompensations([]);
      }
    }).finally(() => setLoading(false));
  }, []);

  const compSummary = useMemo(() => {
    const w = workspace?.summary;
    if (w) {
      return {
        total: w.totalCompensationCents,
        paid: w.paidCompensationCents,
        scheduled: w.scheduledCompensationCents,
      };
    }
    let total = 0;
    let paid = 0;
    let scheduled = 0;
    for (const r of compensations) {
      total += r.amountCents;
      if (r.status === 'PAID') {
        paid += r.amountCents;
      }
      if (r.status === 'SCHEDULED' || r.status === 'APPROVED') {
        scheduled += r.amountCents;
      }
    }
    return { total, paid, scheduled };
  }, [workspace?.summary, compensations]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-3xl" />
      </div>
    );
  }

  const hasLinks = Boolean(workspace?.links?.length);

  if (!hasLinks && !compensations.length) {
    return (
      <EmptyState
        variant="premium"
        icon="fluent-color:wallet-credit-card-16"
        title="No earnings yet"
        description="Salary, pay rows, and other compensation will appear after a business links you and records compensation."
      />
    );
  }

  return (
    <div className="space-y-8">
      {!hasLinks ? (
        <div className="rounded-[1.35rem] border border-amber-200/80 bg-amber-50/90 p-4 text-sm text-smoke-300">
          <p className="font-semibold text-smoke-400">Not linked to a business right now</p>
          <p className="mt-1">
            Historical pay rows are shown below. New compensation appears after a manager links your profile again.
          </p>
        </div>
      ) : null}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-900/60">My pay</p>
        <h1 className="mt-2 font-display text-[1.9rem] font-semibold tracking-tight text-smoke-400">Earnings</h1>
        <p className="mt-2 text-sm text-smoke-200">Salary and compensation rows from your linked businesses.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-smoke-400/10 bg-white/72">
          <CardContent className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Total recorded</p>
            <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">
              {formatMinorUnits(compSummary.total)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-smoke-400/10 bg-white/72">
          <CardContent className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Paid</p>
            <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">
              {formatMinorUnits(compSummary.paid)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-smoke-400/10 bg-white/72">
          <CardContent className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Scheduled</p>
            <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">
              {formatMinorUnits(compSummary.scheduled)}
            </p>
          </CardContent>
        </Card>
      </div>

      {compensations.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {compensations.map((row) => (
            <Card key={row.id} className="border-smoke-400/10 bg-white/72 shadow-soft">
              <CardContent className="flex items-start justify-between gap-4 p-5">
                <div>
                  <p className="text-sm font-semibold text-smoke-400">
                    {row.periodLabel || row.type.replaceAll('_', ' ')}
                  </p>
                  <p className="mt-1 text-xs text-smoke-200">
                    {row.tenantName}
                    {row.branchName ? ` · ${row.branchName}` : ''} · {row.staffName}
                  </p>
                  <p className="mt-2 text-xs text-smoke-200">
                    {row.status} · {new Date(row.effectiveDate).toLocaleDateString()}
                    {row.paidAt ? ` · paid ${new Date(row.paidAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <Icon icon="fluent-color:wallet-credit-card-16" className="ml-auto h-8 w-8" aria-hidden />
                  <p className="mt-2 font-display text-xl font-semibold text-smoke-400">
                    {formatMinorUnits(row.amountCents)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-smoke-400/10 bg-white/72">
          <CardContent className="p-6 text-sm text-smoke-200">No compensation rows yet.</CardContent>
        </Card>
      )}
    </div>
  );
}
