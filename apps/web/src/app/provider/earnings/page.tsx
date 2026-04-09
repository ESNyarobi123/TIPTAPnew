'use client';

import { Icon } from '@iconify/react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { listMyCompensations, listMyPayslips, type MyCompensationRow } from '@/lib/api/staff-me';
import type { PayrollSlipRecord } from '@/lib/api/staff';
import { getProviderWorkspace, type ProviderWorkspace } from '@/lib/api/provider-workspace';
import { getStoredToken } from '@/lib/auth/storage';
import { formatMinorUnits } from '@/lib/format';
import { openPayrollSlipPrint } from '@/lib/payroll-print';
import { payrollLineIsDeduction, payrollLineLabel } from '@/lib/payroll';
import { toast } from '@/lib/toast';

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

export default function ProviderEarningsPage() {
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<ProviderWorkspace | null>(null);
  const [compensations, setCompensations] = useState<MyCompensationRow[]>([]);
  const [payslips, setPayslips] = useState<PayrollSlipRecord[]>([]);
  const [selectedSlipId, setSelectedSlipId] = useState('');

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void Promise.allSettled([
      getProviderWorkspace(token),
      listMyCompensations(token),
      listMyPayslips(token),
    ])
      .then(([workspaceResult, compensationResult, slipResult]) => {
        if (workspaceResult.status === 'rejected') {
          toast.error('Could not load workspace');
          setWorkspace(null);
        } else {
          setWorkspace(workspaceResult.value);
        }
        if (compensationResult.status === 'rejected') {
          toast.error('Could not load compensation list');
          setCompensations([]);
        } else {
          setCompensations(compensationResult.value.items);
        }
        if (slipResult.status === 'rejected') {
          toast.error('Could not load payslips');
          setPayslips([]);
        } else {
          setPayslips(slipResult.value.items);
          setSelectedSlipId((current) =>
            slipResult.value.items.some((row: PayrollSlipRecord) => row.id === current)
              ? current
              : (slipResult.value.items[0]?.id ?? ''),
          );
        }
      })
      .finally(() => setLoading(false));
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
    for (const row of compensations) {
      total += row.amountCents;
      if (row.status === 'PAID') paid += row.amountCents;
      if (row.status === 'SCHEDULED' || row.status === 'APPROVED') scheduled += row.amountCents;
    }
    return { total, paid, scheduled };
  }, [workspace?.summary, compensations]);

  const hasLinks = Boolean(workspace?.links?.length);
  const selectedSlip = useMemo(
    () => payslips.find((row) => row.id === selectedSlipId) ?? payslips[0] ?? null,
    [payslips, selectedSlipId],
  );
  const pendingRows = useMemo(
    () => compensations.filter((row) => !row.payrollSlipId),
    [compensations],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  if (!hasLinks && !compensations.length && !payslips.length) {
    return (
      <EmptyState
        variant="premium"
        icon="fluent-color:wallet-credit-card-16"
        title="No earnings yet"
        description="Payslips and pay rows will appear after a business links you and prepares payroll."
      />
    );
  }

  return (
    <div className="space-y-8">
      {!hasLinks ? (
        <div className="rounded-[1.35rem] border border-amber-200/80 bg-amber-50/90 p-4 text-sm text-smoke-300">
          <p className="font-semibold text-smoke-400">Not linked to a business right now</p>
          <p className="mt-1">Historical payslips and raw rows stay visible below until you are linked again.</p>
        </div>
      ) : null}

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-900/60">My pay</p>
        <h1 className="mt-2 font-display text-[1.9rem] font-semibold tracking-tight text-smoke-400">Earnings & payslips</h1>
        <p className="mt-2 text-sm text-smoke-200">Payroll slips, payout proof, and pending rows from your linked businesses.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-smoke-400/10 bg-white/72">
          <CardContent className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Total recorded</p>
            <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">{formatMinorUnits(compSummary.total)}</p>
          </CardContent>
        </Card>
        <Card className="border-smoke-400/10 bg-white/72">
          <CardContent className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Paid</p>
            <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">{formatMinorUnits(compSummary.paid)}</p>
          </CardContent>
        </Card>
        <Card className="border-smoke-400/10 bg-white/72">
          <CardContent className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Pending</p>
            <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">{formatMinorUnits(compSummary.scheduled)}</p>
          </CardContent>
        </Card>
      </div>

      {payslips.length ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <Card className="border-smoke-400/10 shadow-card">
            <CardHeader className="border-b border-smoke-400/[0.06]">
              <CardTitle className="text-base">Payslips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {payslips.map((slip) => (
                <button
                  key={slip.id}
                  type="button"
                  onClick={() => setSelectedSlipId(slip.id)}
                  className={`w-full rounded-[1.25rem] border px-4 py-4 text-left transition ${
                    selectedSlip?.id === slip.id
                      ? 'border-teal-800/20 bg-teal-50/70 shadow-soft'
                      : 'border-smoke-400/[0.08] bg-ivory-100/75 hover:border-smoke-400/15'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-smoke-400">{slip.periodLabel}</p>
                      <p className="mt-1 text-xs text-smoke-200">
                        {slip.tenant?.name}
                        {slip.branch?.name ? ` · ${slip.branch.name}` : ''} · {slip.slipNumber}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <span className="inline-flex rounded-full border border-smoke-400/10 bg-white px-3 py-1 text-xs font-semibold text-smoke-300">
                        {slip.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-xs text-smoke-200">Net pay</div>
                    <div className="text-sm font-semibold text-smoke-400">{formatMinorUnits(slip.netCents, slip.currency)}</div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {selectedSlip ? (
            <Card className="border-smoke-400/10 shadow-card">
              <CardHeader className="border-b border-smoke-400/[0.06]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">{selectedSlip.periodLabel}</CardTitle>
                    <p className="mt-1 text-xs text-smoke-200">
                      {selectedSlip.slipNumber} · {selectedSlip.tenant?.name}
                      {selectedSlip.branch?.name ? ` · ${selectedSlip.branch.name}` : ''}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => openPayrollSlipPrint(selectedSlip)}>
                    Print slip
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-smoke-400/[0.08] bg-ivory-100/70 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Gross</p>
                    <p className="mt-2 text-lg font-semibold text-smoke-400">{formatMinorUnits(selectedSlip.grossCents, selectedSlip.currency)}</p>
                  </div>
                  <div className="rounded-2xl border border-smoke-400/[0.08] bg-ivory-100/70 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Deductions</p>
                    <p className="mt-2 text-lg font-semibold text-smoke-400">{formatMinorUnits(selectedSlip.deductionCents, selectedSlip.currency)}</p>
                  </div>
                  <div className="rounded-2xl border border-smoke-400/[0.08] bg-ivory-100/70 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Net</p>
                    <p className="mt-2 text-lg font-semibold text-smoke-400">{formatMinorUnits(selectedSlip.netCents, selectedSlip.currency)}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {selectedSlip.compensationRows.map((line) => (
                    <div key={line.id} className="flex items-center justify-between gap-3 rounded-2xl border border-smoke-400/[0.08] bg-white/85 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-smoke-400">{payrollLineLabel(line.lineKind ?? null, line.label ?? null)}</p>
                        <p className="text-xs text-smoke-200">
                          {line.periodLabel ?? selectedSlip.periodLabel}
                          {line.sourceReference ? ` · ${line.sourceReference}` : ''}
                        </p>
                      </div>
                      <div className={`text-right text-sm font-semibold ${payrollLineIsDeduction(line.lineKind ?? null) ? 'text-amber-800' : 'text-teal-800'}`}>
                        {formatMinorUnits(line.amountCents, line.currency)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  {selectedSlip.disbursements.length ? (
                    selectedSlip.disbursements.map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-smoke-400/[0.08] bg-ivory-100/75 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-smoke-400">{entry.method.replaceAll('_', ' ')}</p>
                            <p className="mt-1 text-xs text-smoke-200">{entry.reference || entry.accountMask || 'Recorded proof'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-smoke-400">{formatMinorUnits(entry.amountCents, selectedSlip.currency)}</p>
                            <p className="text-xs text-smoke-200">{formatDate(entry.recordedAt)}</p>
                          </div>
                        </div>
                        {entry.proofNote ? <p className="mt-3 text-xs text-smoke-200">{entry.proofNote}</p> : null}
                      </div>
                    ))
                  ) : (
                    <EmptyState icon="fluent-color:money-hand-24" title="No payout proof yet" description="This payslip has not been fully disbursed yet." />
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {pendingRows.length ? (
        <Card className="border-smoke-400/10 bg-white/72 shadow-card">
          <CardHeader className="border-b border-smoke-400/[0.06]">
            <CardTitle className="text-base">Pending pay rows</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            {pendingRows.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border border-smoke-400/[0.08] bg-ivory-100/75 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-smoke-400">{payrollLineLabel(row.lineKind ?? null, row.label ?? null)}</p>
                  <p className="text-xs text-smoke-200">
                    {row.tenantName}
                    {row.branchName ? ` · ${row.branchName}` : ''} · {row.status}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-smoke-400">{formatMinorUnits(row.amountCents, row.currency)}</p>
                  <p className="text-xs text-smoke-200">{formatDate(row.effectiveDate)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
