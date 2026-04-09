'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { StatusChip } from '@/components/ui/status-chip';
import { Table, Td, Th } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import {
  createPayrollRun,
  getPayrollRun,
  recordPayrollDisbursement,
  type PayrollDisbursementMethod,
  type PayrollRunRecord,
  type PayrollSlipRecord,
  listPayrollRuns,
  updatePayrollRunStatus,
} from '@/lib/api/staff';
import { getStoredToken } from '@/lib/auth/storage';
import { defaultDateRange, formatMinorUnits } from '@/lib/format';
import { openPayrollSlipPrint } from '@/lib/payroll-print';
import { payrollLineIsDeduction, payrollLineLabel } from '@/lib/payroll';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return value;
  }
}

export default function PayrollPage() {
  const { tenantId, branchId, branches } = useScope();
  const defaults = defaultDateRange();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runs, setRuns] = useState<PayrollRunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [selectedRun, setSelectedRun] = useState<PayrollRunRecord | null>(null);
  const [selectedSlipId, setSelectedSlipId] = useState('');
  const [periodLabel, setPeriodLabel] = useState('');
  const [periodStart, setPeriodStart] = useState(defaults.startDate);
  const [periodEnd, setPeriodEnd] = useState(defaults.endDate);
  const [currency, setCurrency] = useState('TZS');
  const [notes, setNotes] = useState('');
  const [runBranchId, setRunBranchId] = useState(branchId ?? '');
  const [method, setMethod] = useState<PayrollDisbursementMethod>('MOBILE_MONEY');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [accountMask, setAccountMask] = useState('');
  const [recipientLabel, setRecipientLabel] = useState('');
  const [proofNote, setProofNote] = useState('');

  useEffect(() => {
    setRunBranchId(branchId ?? '');
  }, [branchId]);

  async function loadRuns(keepSelection = true) {
    const token = getStoredToken();
    if (!token || !tenantId) {
      setRuns([]);
      setSelectedRun(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const payload = await listPayrollRuns(token, { tenantId, branchId: branchId ?? null });
      setRuns(payload);
      const nextRunId =
        keepSelection && payload.some((row) => row.id === selectedRunId)
          ? selectedRunId
          : payload[0]?.id ?? '';
      setSelectedRunId(nextRunId);
      if (nextRunId) {
        const detail = await getPayrollRun(token, nextRunId);
        setSelectedRun(detail);
        setSelectedSlipId(detail.slips?.[0]?.id ?? '');
      } else {
        setSelectedRun(null);
        setSelectedSlipId('');
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not load payroll desk');
      setRuns([]);
      setSelectedRun(null);
      setSelectedSlipId('');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRuns(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, branchId]);

  async function openRun(runId: string) {
    const token = getStoredToken();
    if (!token) return;
    setSelectedRunId(runId);
    setLoading(true);
    try {
      const detail = await getPayrollRun(token, runId);
      setSelectedRun(detail);
      setSelectedSlipId((current) => detail.slips?.some((slip) => slip.id === current) ? current : (detail.slips?.[0]?.id ?? ''));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not open payroll run');
    } finally {
      setLoading(false);
    }
  }

  async function onCreateRun(e: React.FormEvent) {
    e.preventDefault();
    const token = getStoredToken();
    if (!token || !tenantId) return;
    setSaving(true);
    try {
      const run = await createPayrollRun(token, {
        tenantId,
        branchId: runBranchId || null,
        periodLabel: periodLabel || `${new Date(periodStart).toLocaleString(undefined, { month: 'short', year: 'numeric' })}`,
        periodStart: new Date(periodStart).toISOString(),
        periodEnd: new Date(periodEnd).toISOString(),
        currency,
        notes,
      });
      toast.success('Payroll run created');
      setPeriodLabel('');
      setNotes('');
      setSelectedRunId(run.id);
      setSelectedRun(run);
      setSelectedSlipId(run.slips?.[0]?.id ?? '');
      await loadRuns();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not create payroll run');
    } finally {
      setSaving(false);
    }
  }

  async function changeRunStatus(status: PayrollRunRecord['status']) {
    const token = getStoredToken();
    if (!token || !selectedRunId) return;
    setSaving(true);
    try {
      const updated = await updatePayrollRunStatus(token, selectedRunId, { status });
      toast.success(`Payroll run moved to ${status.toLowerCase()}`);
      setSelectedRun(updated);
      setRuns((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      if (!updated.slips?.some((slip) => slip.id === selectedSlipId)) {
        setSelectedSlipId(updated.slips?.[0]?.id ?? '');
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not update payroll run');
    } finally {
      setSaving(false);
    }
  }

  const selectedSlip = useMemo<PayrollSlipRecord | null>(
    () => selectedRun?.slips?.find((slip) => slip.id === selectedSlipId) ?? selectedRun?.slips?.[0] ?? null,
    [selectedRun, selectedSlipId],
  );

  const selectedSlipRecorded = useMemo(
    () => selectedSlip?.disbursements.filter((row) => row.status === 'RECORDED').reduce((sum, row) => sum + row.amountCents, 0) ?? 0,
    [selectedSlip],
  );
  const selectedSlipRemaining = useMemo(
    () => Math.max(0, (selectedSlip?.netCents ?? 0) - selectedSlipRecorded),
    [selectedSlip, selectedSlipRecorded],
  );

  async function onRecordDisbursement(e: React.FormEvent) {
    e.preventDefault();
    const token = getStoredToken();
    if (!token || !selectedSlip) return;
    setSaving(true);
    try {
      const updated = await recordPayrollDisbursement(token, selectedSlip.id, {
        method,
        amountCents: amount ? Math.max(0, Math.floor(Number(amount) || 0)) : undefined,
        reference: reference || null,
        accountMask: accountMask || null,
        recipientLabel: recipientLabel || null,
        proofNote: proofNote || null,
      });
      toast.success('Disbursement recorded');
      setAmount('');
      setReference('');
      setAccountMask('');
      setRecipientLabel('');
      setProofNote('');
      setSelectedRun((current) =>
        current
          ? {
              ...current,
              slips: (current.slips ?? []).map((slip) => (slip.id === updated.id ? updated : slip)),
              status:
                (current.slips ?? []).every((slip) => (slip.id === updated.id ? updated.status : slip.status) === 'PAID' || (slip.id === updated.id ? updated.status : slip.status) === 'RECONCILED')
                  ? 'PAID'
                  : current.status,
            }
          : current,
      );
      await loadRuns();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not record disbursement');
    } finally {
      setSaving(false);
    }
  }

  const platformStats = useMemo(() => {
    const gross = runs.reduce((sum, run) => sum + run.summary.grossCents, 0);
    const net = runs.reduce((sum, run) => sum + run.summary.netCents, 0);
    const approved = runs.filter((run) => run.status === 'APPROVED').length;
    const active = runs.filter((run) => ['SUBMITTED', 'APPROVED', 'PAID'].includes(run.status)).length;
    return { gross, net, approved, active };
  }, [runs]);

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        eyebrow="Money & trust"
        title="Payroll desk"
        description="Runs, payslips, and payout proof in one place."
      />

      {loading && !runs.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon="fluent-color:wallet-credit-card-16" label="Run gross" value={formatMinorUnits(platformStats.gross)} />
          <StatCard icon="fluent-color:money-hand-24" label="Run net" value={formatMinorUnits(platformStats.net)} />
          <StatCard icon="fluent-color:clock-24" label="Open runs" value={platformStats.active} />
          <StatCard icon="fluent-color:task-list-square-24" label="Approved" value={platformStats.approved} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <Card className="border-smoke-400/10 shadow-card">
          <CardHeader className="border-b border-smoke-400/[0.06]">
            <CardTitle className="text-base">Create run</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {!tenantId ? (
              <EmptyState icon="fluent-color:building-people-24" title="Pick a workspace first" description="Select a business and branch in the header to open payroll." />
            ) : (
              <form className="space-y-4" onSubmit={onCreateRun}>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="pr-branch">Branch</Label>
                    <Select id="pr-branch" value={runBranchId} onChange={(e) => setRunBranchId(e.target.value)}>
                      <option value="">Tenant-wide</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name ?? branch.id.slice(0, 8)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pr-currency">Currency</Label>
                    <Input id="pr-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="pr-label">Period label</Label>
                    <Input id="pr-label" value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="Apr 2026 payroll" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pr-start">Start</Label>
                    <Input id="pr-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pr-end">End</Label>
                    <Input id="pr-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pr-notes">Notes</Label>
                  <Textarea id="pr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional payroll note" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={saving || !tenantId}>
                    {saving ? 'Creating…' : 'Generate payslips'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void loadRuns()}>
                    Refresh
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="border-smoke-400/10 shadow-card">
          <CardHeader className="border-b border-smoke-400/[0.06]">
            <CardTitle className="text-base">Recent runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            {runs.length ? (
              runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => void openRun(run.id)}
                  className={`w-full rounded-[1.25rem] border px-4 py-4 text-left transition ${
                    selectedRunId === run.id
                      ? 'border-teal-800/20 bg-teal-50/70 shadow-soft'
                      : 'border-smoke-400/[0.08] bg-ivory-100/75 hover:border-smoke-400/15'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-smoke-400">{run.periodLabel}</p>
                      <p className="mt-1 text-xs text-smoke-200">
                        {formatDate(run.periodStart)} - {formatDate(run.periodEnd)}
                      </p>
                    </div>
                    <StatusChip status={run.status} />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-smoke-200">Slips</p>
                      <p className="mt-1 text-sm font-semibold text-smoke-400">{run.summary.slipCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-smoke-200">Net</p>
                      <p className="mt-1 text-sm font-semibold text-smoke-400">{formatMinorUnits(run.summary.netCents, run.currency)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-smoke-200">Paid</p>
                      <p className="mt-1 text-sm font-semibold text-smoke-400">{run.summary.paidCount}/{run.summary.slipCount}</p>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <EmptyState icon="fluent-color:task-list-square-24" title="No payroll runs yet" description="Create the first run from approved or scheduled pay rows." />
            )}
          </CardContent>
        </Card>
      </div>

      {selectedRun ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <Card className="border-smoke-400/10 shadow-card">
            <CardHeader className="border-b border-smoke-400/[0.06]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Run detail</p>
                  <CardTitle className="mt-2 text-xl">{selectedRun.periodLabel}</CardTitle>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedRun.status === 'SUBMITTED' ? (
                    <Button type="button" size="sm" disabled={saving} onClick={() => void changeRunStatus('APPROVED')}>
                      Approve run
                    </Button>
                  ) : null}
                  {selectedRun.status === 'PAID' ? (
                    <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void changeRunStatus('RECONCILED')}>
                      Reconcile run
                    </Button>
                  ) : null}
                  {['SUBMITTED', 'APPROVED'].includes(selectedRun.status) ? (
                    <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void changeRunStatus('VOID')}>
                      Void run
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-smoke-400/[0.08] bg-ivory-100/70 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Gross</p>
                  <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">{formatMinorUnits(selectedRun.summary.grossCents, selectedRun.currency)}</p>
                </div>
                <div className="rounded-2xl border border-smoke-400/[0.08] bg-ivory-100/70 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Deductions</p>
                  <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">{formatMinorUnits(selectedRun.summary.deductionCents, selectedRun.currency)}</p>
                </div>
                <div className="rounded-2xl border border-smoke-400/[0.08] bg-ivory-100/70 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Net</p>
                  <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">{formatMinorUnits(selectedRun.summary.netCents, selectedRun.currency)}</p>
                </div>
              </div>

              {selectedRun.slips?.length ? (
                <Table>
                  <thead>
                    <tr>
                      <Th>Slip</Th>
                      <Th>Status</Th>
                      <Th>Gross</Th>
                      <Th>Net</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRun.slips.map((slip) => (
                      <tr key={slip.id}>
                        <Td>
                          <button type="button" onClick={() => setSelectedSlipId(slip.id)} className="text-left">
                            <div className="font-medium text-smoke-400">{slip.staff?.displayName ?? slip.staffId}</div>
                            <div className="text-xs text-smoke-200">{slip.slipNumber}</div>
                          </button>
                        </Td>
                        <Td><StatusChip status={slip.status} /></Td>
                        <Td className="text-sm font-medium text-smoke-400">{formatMinorUnits(slip.grossCents, slip.currency)}</Td>
                        <Td className="text-sm font-medium text-smoke-400">{formatMinorUnits(slip.netCents, slip.currency)}</Td>
                        <Td className="text-right">
                          <Button type="button" variant="outline" size="sm" onClick={() => openPayrollSlipPrint(slip)}>
                            Print
                          </Button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <EmptyState icon="fluent-color:wallet-credit-card-16" title="No payslips" description="This run has no staff slips yet." />
              )}
            </CardContent>
          </Card>

          {selectedSlip ? (
            <div className="space-y-6">
              <Card className="border-smoke-400/10 shadow-card">
                <CardHeader className="border-b border-smoke-400/[0.06]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-base">{selectedSlip.staff?.displayName ?? 'Payslip'}</CardTitle>
                      <p className="mt-1 text-xs text-smoke-200">{selectedSlip.slipNumber} · {selectedSlip.periodLabel}</p>
                    </div>
                    <StatusChip status={selectedSlip.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
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

                  <div className="rounded-2xl border border-smoke-400/[0.08] bg-ivory-100/75 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-smoke-400">Disbursement status</p>
                        <p className="mt-1 text-xs text-smoke-200">
                          Recorded {formatMinorUnits(selectedSlipRecorded, selectedSlip.currency)} · Remaining {formatMinorUnits(selectedSlipRemaining, selectedSlip.currency)}
                        </p>
                        {selectedSlip.staff?.providerProfile?.payoutProfile?.method || selectedSlip.staff?.providerProfile?.payoutProfile?.accountMask ? (
                          <p className="mt-2 text-xs text-smoke-200">
                            Preferred payout:{' '}
                            {selectedSlip.staff?.providerProfile?.payoutProfile?.method?.replaceAll('_', ' ') ?? 'Method not set'}
                            {selectedSlip.staff?.providerProfile?.payoutProfile?.accountMask
                              ? ` · ${selectedSlip.staff.providerProfile.payoutProfile.accountMask}`
                              : ''}
                            {selectedSlip.staff?.providerProfile?.payoutProfile?.recipientLabel
                              ? ` · ${selectedSlip.staff.providerProfile.payoutProfile.recipientLabel}`
                              : ''}
                          </p>
                        ) : null}
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => openPayrollSlipPrint(selectedSlip)}>
                        Print slip
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-smoke-400/10 shadow-card">
                <CardHeader className="border-b border-smoke-400/[0.06]">
                  <CardTitle className="text-base">Record payout</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {selectedSlip.status === 'APPROVED' || (selectedSlip.status === 'PAID' && selectedSlipRemaining > 0) ? (
                    <form className="space-y-4" onSubmit={onRecordDisbursement}>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="pd-method">Method</Label>
                          <Select id="pd-method" value={method} onChange={(e) => setMethod(e.target.value as PayrollDisbursementMethod)}>
                            <option value="MOBILE_MONEY">Mobile money</option>
                            <option value="BANK_TRANSFER">Bank transfer</option>
                            <option value="CASH">Cash</option>
                            <option value="MANUAL_OTHER">Manual other</option>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="pd-amount">Amount</Label>
                          <Input id="pd-amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`${selectedSlipRemaining / 100}`} />
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="pd-reference">Reference</Label>
                          <Input id="pd-reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Provider txn / cash ref" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="pd-mask">Account / phone mask</Label>
                          <Input id="pd-mask" value={accountMask} onChange={(e) => setAccountMask(e.target.value)} placeholder="****1234 or +2557***" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pd-recipient">Recipient label</Label>
                        <Input id="pd-recipient" value={recipientLabel} onChange={(e) => setRecipientLabel(e.target.value)} placeholder={selectedSlip.staff?.displayName ?? 'Staff'} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pd-note">Proof note</Label>
                        <Textarea id="pd-note" value={proofNote} onChange={(e) => setProofNote(e.target.value)} placeholder="Optional payout note or proof summary" />
                      </div>
                      <Button type="submit" disabled={saving}>
                        {saving ? 'Saving…' : 'Record disbursement'}
                      </Button>
                    </form>
                  ) : (
                    <EmptyState icon="fluent-color:money-hand-24" title="No payout action needed" description="Approve the run first, or this slip is already fully paid." />
                  )}
                </CardContent>
              </Card>

              <Card className="border-smoke-400/10 shadow-card">
                <CardHeader className="border-b border-smoke-400/[0.06]">
                  <CardTitle className="text-base">Disbursement log</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-6">
                  {selectedSlip.disbursements.length ? (
                    selectedSlip.disbursements.map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-smoke-400/[0.08] bg-ivory-100/75 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-smoke-400">{entry.method.replaceAll('_', ' ')}</p>
                            <p className="mt-1 text-xs text-smoke-200">
                              {entry.reference || entry.accountMask || 'Recorded proof'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-smoke-400">{formatMinorUnits(entry.amountCents, selectedSlip.currency)}</p>
                            <p className="text-xs text-smoke-200">{formatDateTime(entry.recordedAt)}</p>
                          </div>
                        </div>
                        {entry.proofNote ? <p className="mt-3 text-xs text-smoke-200">{entry.proofNote}</p> : null}
                      </div>
                    ))
                  ) : (
                    <EmptyState icon="fluent-color:wallet-credit-card-16" title="No proof recorded" description="Record the salary payout here so the payslip becomes paid." />
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <EmptyState icon="fluent-color:wallet-credit-card-16" title="Choose a payslip" description="Select a run and slip to see line items and payout proof." />
          )}
        </div>
      ) : null}
    </div>
  );
}
