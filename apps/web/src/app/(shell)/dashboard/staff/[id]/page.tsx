'use client';

import Link from 'next/link';
import { Icon } from '@iconify/react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MetricMini } from '@/components/ui/metric-mini';
import { SectionHeader } from '@/components/ui/section-header';
import { Select } from '@/components/ui/select';
import { StatusChip } from '@/components/ui/status-chip';
import { TabList } from '@/components/ui/tabs';
import { Table, Td, Th } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import { formatMinorUnits } from '@/lib/format';
import {
  createStaffCompensation,
  createAssignment,
  deleteStaff,
  deactivateStaff,
  getStaff,
  getStaffInternal,
  listStaffCompensation,
  listAssignments,
  type PayrollLineKind,
  type StaffCompensationStatus,
  updateAssignment,
  updateStaff,
  updateStaffInternal,
} from '@/lib/api/staff';
import { getProviderProfileInternal, getProviderProfilePublic, updateProviderProfileInternal } from '@/lib/api/provider-registry';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

type AssignmentRow = {
  id: string;
  branchId?: string;
  status?: string;
  mode?: string;
  startedAt?: string;
  endedAt?: string | null;
};

type CompensationRow = {
  id: string;
  branchId?: string | null;
  type?: string;
  status?: string;
  lineKind?: PayrollLineKind | null;
  label?: string | null;
  sourceReference?: string | null;
  amountCents?: number;
  currency?: string;
  periodLabel?: string | null;
  effectiveDate?: string;
  paidAt?: string | null;
  notes?: string | null;
  payrollSlipId?: string | null;
  lockedAt?: string | null;
};

function asAssign(x: unknown): AssignmentRow {
  const o = (x ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    branchId: typeof o.branchId === 'string' ? o.branchId : undefined,
    status: typeof o.status === 'string' ? o.status : undefined,
    mode: typeof o.mode === 'string' ? o.mode : undefined,
    startedAt: typeof o.startedAt === 'string' ? o.startedAt : undefined,
    endedAt: typeof o.endedAt === 'string' ? o.endedAt : (o.endedAt === null ? null : undefined),
  };
}

function asCompensation(x: unknown): CompensationRow {
  const o = (x ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    branchId: typeof o.branchId === 'string' ? o.branchId : (o.branchId === null ? null : undefined),
    type: typeof o.type === 'string' ? o.type : undefined,
    status: typeof o.status === 'string' ? o.status : undefined,
    lineKind: typeof o.lineKind === 'string' ? (o.lineKind as PayrollLineKind) : (o.lineKind === null ? null : undefined),
    label: typeof o.label === 'string' ? o.label : (o.label === null ? null : undefined),
    sourceReference: typeof o.sourceReference === 'string' ? o.sourceReference : (o.sourceReference === null ? null : undefined),
    amountCents: typeof o.amountCents === 'number' ? o.amountCents : undefined,
    currency: typeof o.currency === 'string' ? o.currency : undefined,
    periodLabel: typeof o.periodLabel === 'string' ? o.periodLabel : (o.periodLabel === null ? null : undefined),
    effectiveDate: typeof o.effectiveDate === 'string' ? o.effectiveDate : undefined,
    paidAt: typeof o.paidAt === 'string' ? o.paidAt : (o.paidAt === null ? null : undefined),
    notes: typeof o.notes === 'string' ? o.notes : (o.notes === null ? null : undefined),
    payrollSlipId: typeof o.payrollSlipId === 'string' ? o.payrollSlipId : (o.payrollSlipId === null ? null : undefined),
    lockedAt: typeof o.lockedAt === 'string' ? o.lockedAt : (o.lockedAt === null ? null : undefined),
  };
}

export default function StaffDetailPage() {
  const params = useParams<{ id: string }>();
  const staffId = params?.id;
  const { tenantId, branches } = useScope();
  const [staff, setStaff] = useState<Record<string, unknown> | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [compensationRows, setCompensationRows] = useState<CompensationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [publicHandle, setPublicHandle] = useState('');
  const [assignBranchId, setAssignBranchId] = useState('');
  const [assignMode, setAssignMode] = useState<'PART_TIME_SHARED' | 'FULL_TIME_EXCLUSIVE' | 'TEMPORARY_CONTRACT' | 'SHIFT_BASED'>(
    'PART_TIME_SHARED',
  );
  const [privateNotes, setPrivateNotes] = useState('');
  const [canSeeInternal, setCanSeeInternal] = useState(false);
  const [providerPublic, setProviderPublic] = useState<Record<string, unknown> | null>(null);
  const [providerInternal, setProviderInternal] = useState<Record<string, unknown> | null>(null);
  const [providerInternalNotes, setProviderInternalNotes] = useState('');
  const [providerId, setProviderId] = useState<string | null>(null);
  const [tab, setTab] = useState<'public' | 'internal' | 'assignments' | 'pay'>('public');
  const [payLineKind, setPayLineKind] = useState<PayrollLineKind>('BASIC_SALARY');
  const [payStatus, setPayStatus] = useState<StaffCompensationStatus>('SCHEDULED');
  const [payAmount, setPayAmount] = useState('0');
  const [payCurrency, setPayCurrency] = useState('TZS');
  const [payBranchId, setPayBranchId] = useState('');
  const [payPeriodLabel, setPayPeriodLabel] = useState('');
  const [payEffectiveDate, setPayEffectiveDate] = useState('');
  const [payLabel, setPayLabel] = useState('');
  const [paySourceReference, setPaySourceReference] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const canEdit = useMemo(() => Boolean(tenantId && staffId), [tenantId, staffId]);
  const branchNameById = useMemo(
    () => new Map(branches.map((branch) => [branch.id, branch.name ?? branch.id.slice(0, 8)])),
    [branches],
  );
  const activeAssignmentsCount = useMemo(
    () => assignments.filter((assignment) => assignment.status === 'ACTIVE' && !assignment.endedAt).length,
    [assignments],
  );
  const paidCompensationTotal = useMemo(
    () =>
      compensationRows
        .filter((row) => row.status === 'PAID')
        .reduce((sum, row) => sum + (row.amountCents ?? 0), 0),
    [compensationRows],
  );
  const staffStatus = typeof staff?.status === 'string' ? staff.status : 'ACTIVE';
  const staffName =
    typeof staff?.displayName === 'string' && staff.displayName ? staff.displayName : 'Staff profile';
  const providerCode =
    typeof (providerPublic as Record<string, unknown> | null)?.registryCode === 'string'
      ? String((providerPublic as Record<string, unknown>).registryCode)
      : '—';
  const qrHref = staffId
    ? `/dashboard/qr?type=STAFF_QR&staffId=${encodeURIComponent(staffId)}&scope=${staff?.branchId ? 'branch' : 'tenant'}`
    : '/dashboard/qr?type=STAFF_QR';

  async function loadAll() {
    const token = getStoredToken();
    if (!token || !staffId) return;
    setLoading(true);
    try {
      const s = (await getStaff(token, staffId)) as Record<string, unknown>;
      setStaff(s);
      setDisplayName(typeof s.displayName === 'string' ? s.displayName : '');
      setEmail(typeof s.email === 'string' ? s.email : '');
      setPhone(typeof s.phone === 'string' ? s.phone : '');
      setPublicHandle(typeof s.publicHandle === 'string' ? s.publicHandle : '');

      const providerProfileId =
        typeof s.providerProfileId === 'string' && s.providerProfileId ? s.providerProfileId : null;
      setProviderId(providerProfileId);
      if (providerProfileId) {
        try {
          const pub = (await getProviderProfilePublic(providerProfileId)) as unknown as Record<string, unknown>;
          setProviderPublic(pub);
        } catch {
          setProviderPublic(null);
        }
        try {
          const internal = (await getProviderProfileInternal(token, providerProfileId)) as unknown as Record<string, unknown>;
          setProviderInternal(internal);
          setProviderInternalNotes(typeof (internal as any).internalNotes === 'string' ? (internal as any).internalNotes : '');
        } catch {
          setProviderInternal(null);
          setProviderInternalNotes('');
        }
      } else {
        setProviderPublic(null);
        setProviderInternal(null);
        setProviderInternalNotes('');
      }

      try {
        const internal = (await getStaffInternal(token, staffId)) as Record<string, unknown>;
        setPrivateNotes(typeof internal.privateNotes === 'string' ? internal.privateNotes : '');
        setCanSeeInternal(true);
      } catch {
        setCanSeeInternal(false);
        setPrivateNotes('');
      }
      const a = await listAssignments(token, staffId);
      setAssignments((Array.isArray(a) ? a : []).map(asAssign).filter((r) => r.id));
      const compensation = await listStaffCompensation(token, staffId);
      setCompensationRows((Array.isArray(compensation) ? compensation : []).map(asCompensation).filter((r) => r.id));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const token = getStoredToken();
    if (!token || !staffId) return;
    setPending(true);
    try {
      await updateStaff(token, staffId, {
        displayName,
        email: email || null,
        phone: phone || null,
        publicHandle: publicHandle || null,
      });
      toast.success('Staff updated');
      await loadAll();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Save failed');
    } finally {
      setPending(false);
    }
  }

  async function onSaveInternal(e: React.FormEvent) {
    e.preventDefault();
    const token = getStoredToken();
    if (!token || !staffId) return;
    setPending(true);
    try {
      await updateStaffInternal(token, staffId, { privateNotes: privateNotes || null });
      toast.success('Internal notes saved');
      await loadAll();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Save failed');
    } finally {
      setPending(false);
    }
  }

  async function onSaveProviderInternal(e: React.FormEvent) {
    e.preventDefault();
    const token = getStoredToken();
    if (!token || !providerId) return;
    setPending(true);
    try {
      await updateProviderProfileInternal(token, providerId, { internalNotes: providerInternalNotes || null });
      toast.success('Provider internal notes saved');
      await loadAll();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Save failed');
    } finally {
      setPending(false);
    }
  }

  async function onDeactivate() {
    const token = getStoredToken();
    if (!token || !staffId) return;
    setPending(true);
    try {
      await deactivateStaff(token, staffId);
      toast.success('Staff deactivated');
      await loadAll();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Deactivate failed');
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    const token = getStoredToken();
    if (!token || !staffId) return;
    const confirmed = window.confirm(
      'Delete this staff record from the active team? TIPTAP will end active assignments and hide the profile from normal lists.',
    );
    if (!confirmed) {
      return;
    }
    setPending(true);
    try {
      await deleteStaff(token, staffId);
      toast.success('Staff removed from active team');
      window.location.href = '/dashboard/staff';
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Delete failed');
      setPending(false);
    }
  }

  async function onAssign() {
    const token = getStoredToken();
    if (!token || !staffId || !assignBranchId) return;
    setPending(true);
    try {
      await createAssignment(token, staffId, { branchId: assignBranchId, mode: assignMode });
      toast.success('Assignment created');
      setAssignBranchId('');
      await loadAll();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Assign failed');
    } finally {
      setPending(false);
    }
  }

  async function onCreatePay() {
    const token = getStoredToken();
    if (!token || !staffId) return;
    setPending(true);
    try {
      await createStaffCompensation(token, staffId, {
        branchId: payBranchId || null,
        status: payStatus,
        lineKind: payLineKind,
        label: payLabel || null,
        sourceReference: paySourceReference || null,
        amountCents: Math.max(0, Math.floor(Number(payAmount) || 0)),
        currency: payCurrency || 'TZS',
        periodLabel: payPeriodLabel || null,
        effectiveDate: payEffectiveDate ? new Date(payEffectiveDate).toISOString() : null,
        notes: payNotes || null,
      });
      toast.success('Pay row created');
      setPayAmount('0');
      setPayPeriodLabel('');
      setPayEffectiveDate('');
      setPayLabel('');
      setPaySourceReference('');
      setPayNotes('');
      await loadAll();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save pay row');
    } finally {
      setPending(false);
    }
  }

  async function endAssignment(assignmentId: string) {
    const token = getStoredToken();
    if (!token || !staffId) return;
    setPending(true);
    try {
      await updateAssignment(token, staffId, assignmentId, { status: 'ENDED', endedAt: new Date().toISOString() });
      toast.success('Assignment ended');
      await loadAll();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    } finally {
      setPending(false);
    }
  }

  if (!staffId) {
    return <EmptyState icon="ph:user-duotone" title="Missing staff id" />;
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Staff"
        title={loading ? 'Loading…' : staffName}
        description="Manage guest-facing identity, internal notes, assignments, QR flow, and lifecycle actions for this staff record."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/staff">Back to roster</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={qrHref}>Generate QR</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/payroll">Payroll desk</Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => void onDelete()}
              className="text-rose-700 hover:bg-rose-50 hover:text-rose-900"
            >
              Delete staff
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricMini icon="ph:user-circle-check-duotone" label="Employment status" value={<StatusChip status={staffStatus} />} hint="Manager-level state" />
        <MetricMini icon="ph:git-branch-duotone" label="Active assignments" value={activeAssignmentsCount} hint="Open branch relationships" />
        <MetricMini
          icon="ph:hash-duotone"
          label="Provider code"
          value={providerCode}
          hint={publicHandle ? `Public handle @${publicHandle}` : 'No public handle yet'}
        />
        <MetricMini
          icon="ph:wallet-duotone"
          label="Paid"
          value={formatMinorUnits(paidCompensationTotal)}
          hint={compensationRows.length ? `${compensationRows.length} pay rows` : 'No pay rows yet'}
        />
      </div>

      <TabList
        tabs={[
          { id: 'public', label: 'Profile' },
          { id: 'internal', label: 'Internal' },
          { id: 'assignments', label: 'Assignments' },
          { id: 'pay', label: 'Pay' },
        ]}
        value={tab}
        onChange={(id) => setTab(id as any)}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {tab === 'public' ? (
          providerPublic ? (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Public / shareable profile</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <div className="text-sm font-medium text-smoke-400">
                    {typeof providerPublic.displayName === 'string' ? providerPublic.displayName : 'Provider'}
                  </div>
                  {typeof providerPublic.headline === 'string' && providerPublic.headline ? (
                    <div className="mt-1 text-sm text-smoke-200">{providerPublic.headline}</div>
                  ) : null}
                  {typeof providerPublic.verifiedSummary === 'string' && providerPublic.verifiedSummary ? (
                    <div className="mt-3 rounded-xl border border-smoke-400/10 bg-ivory-50/70 px-4 py-3 text-sm text-smoke-200">
                      {providerPublic.verifiedSummary}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-xl border border-smoke-400/10 bg-ivory-50/70 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Provider code</div>
                  <div className="mt-1 font-mono text-sm font-medium text-smoke-400">
                    {typeof (providerPublic as any).registryCode === 'string' && (providerPublic as any).registryCode
                      ? (providerPublic as any).registryCode
                      : '—'}
                  </div>
                  <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Rating</div>
                  <div className="mt-1 text-sm font-medium text-smoke-400">
                    {typeof providerPublic.publicRatingAvg === 'number'
                      ? providerPublic.publicRatingAvg.toFixed(2)
                      : '—'}
                    <span className="ml-2 text-xs text-smoke-200">
                      ({typeof providerPublic.publicRatingCount === 'number' ? providerPublic.publicRatingCount : 0})
                    </span>
                  </div>
                  <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Skills</div>
                  <div className="mt-1 text-xs text-smoke-200">
                    {Array.isArray((providerPublic as any).skills) && (providerPublic as any).skills.length
                      ? (providerPublic as any).skills.slice(0, 8).join(', ')
                      : '—'}
                  </div>
                  <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Public slug</div>
                  <div className="mt-1 font-mono text-xs text-smoke-200">
                    {typeof (providerInternal as any)?.publicSlug === 'string' && (providerInternal as any).publicSlug
                      ? (providerInternal as any).publicSlug
                      : '—'}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={qrHref}>Generate QR</Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link href="/dashboard/conversations">Open WhatsApp</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Public profile</CardTitle>
              </CardHeader>
              <CardContent>
                <EmptyState
                  icon="ph:identification-badge-duotone"
                  title="No provider profile linked"
                  description="Link a portable provider profile to enable public/shareable identity across tenants."
                />
              </CardContent>
            </Card>
          )
        ) : null}

        {tab === 'internal' ? (
          <>
            {providerInternal ? (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Provider internal notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-amber-900/10 bg-amber-50/35 px-4 py-3 text-sm text-amber-950">
                    Visible only to tenant owners and SUPER_ADMIN for linked employers.
                  </div>
                  <form onSubmit={onSaveProviderInternal} className="mt-4 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="pp-notes">Internal notes</Label>
                      <Textarea
                        id="pp-notes"
                        value={providerInternalNotes}
                        onChange={(e) => setProviderInternalNotes(e.target.value)}
                        placeholder="Verified experience context, sensitive feedback, certifications checks…"
                      />
                    </div>
                    <Button type="submit" disabled={pending}>
                      {pending ? 'Saving…' : 'Save provider internal notes'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile</CardTitle>
            </CardHeader>
            <CardContent>
            <form onSubmit={onSave} className="space-y-4">
              <div className="grid gap-3 rounded-2xl border border-smoke-400/10 bg-ivory-50/70 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Role in tenant</p>
                  <p className="mt-1 text-sm font-medium text-smoke-400">
                    {typeof staff?.roleInTenant === 'string' ? staff.roleInTenant.replace(/_/g, ' ') : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Home scope</p>
                  <p className="mt-1 text-sm font-medium text-smoke-400">
                    {typeof staff?.branchId === 'string'
                      ? branchNameById.get(staff.branchId) ?? staff.branchId.slice(0, 8)
                      : 'Tenant-wide'}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sd-name">Display name</Label>
                <Input id="sd-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sd-email">Email</Label>
                  <Input id="sd-email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sd-phone">Phone</Label>
                  <Input id="sd-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sd-handle">Public handle</Label>
                <Input id="sd-handle" value={publicHandle} onChange={(e) => setPublicHandle(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={!canEdit || pending}>
                  {pending ? 'Saving…' : 'Save'}
                </Button>
                <Button type="button" variant="outline" disabled={pending} onClick={() => void loadAll()}>
                  Refresh
                </Button>
                <Button type="button" variant="ghost" disabled={pending} onClick={() => void onDeactivate()}>
                  Deactivate
                </Button>
                <Button asChild type="button" variant="outline" disabled={pending}>
                  <Link href={qrHref}>Generate QR</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

            {canSeeInternal ? (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Staff internal notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={onSaveInternal} className="space-y-4">
                    <div className="rounded-xl border border-amber-900/10 bg-amber-50/35 px-4 py-3 text-sm text-amber-950">
                      Internal notes are visible only to the current employer admins and SUPER_ADMIN. This is not shared to other businesses.
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sd-notes">Internal notes</Label>
                      <Textarea
                        id="sd-notes"
                        value={privateNotes}
                        onChange={(e) => setPrivateNotes(e.target.value)}
                        placeholder="Disciplinary notes, contract context, private feedback…"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={pending}>
                        {pending ? 'Saving…' : 'Save staff internal notes'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : null}

        {tab === 'assignments' ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Assignments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="sd-assign">Assign to branch</Label>
                <Select id="sd-assign" value={assignBranchId} onChange={(e) => setAssignBranchId(e.target.value)}>
                  <option value="">Select branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name ?? b.id.slice(0, 8)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sd-mode">Mode</Label>
                <Select id="sd-mode" value={assignMode} onChange={(e) => setAssignMode(e.target.value as any)}>
                  <option value="PART_TIME_SHARED">Part-time shared</option>
                  <option value="FULL_TIME_EXCLUSIVE">Full-time exclusive</option>
                  <option value="TEMPORARY_CONTRACT">Temporary contract</option>
                  <option value="SHIFT_BASED">Shift-based</option>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="button" onClick={() => void onAssign()} disabled={!assignBranchId || pending}>
                  Assign
                </Button>
              </div>
            </div>

            {assignments.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>Branch</Th>
                    <Th>Status</Th>
                    <Th>Mode</Th>
                    <Th>Started</Th>
                    <Th>Ended</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id}>
                      <Td className="text-sm text-smoke-300">
                        {a.branchId ? branchNameById.get(a.branchId) ?? a.branchId.slice(0, 8) : '—'}
                      </Td>
                      <Td>{a.status ? <StatusChip status={a.status} /> : '—'}</Td>
                      <Td className="text-xs text-smoke-200">{a.mode ?? '—'}</Td>
                      <Td className="text-xs text-smoke-200">{a.startedAt ? new Date(a.startedAt).toLocaleString() : '—'}</Td>
                      <Td className="text-xs text-smoke-200">{a.endedAt ? new Date(a.endedAt).toLocaleString() : '—'}</Td>
                      <Td className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending || a.status === 'ENDED'}
                          onClick={() => void endAssignment(a.id)}
                        >
                          End
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState
                icon="ph:arrow-bend-down-right-duotone"
                title="No assignments yet"
                description="Assign this staff member to a branch to enable branch-scoped operations and QR targeting."
              />
            )}
            </CardContent>
          </Card>
        ) : null}

        {tab === 'pay' ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Pay</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <div className="space-y-4 rounded-2xl border border-smoke-400/10 bg-ivory-50/70 p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="sd-pay-kind">Line kind</Label>
                      <Select id="sd-pay-kind" value={payLineKind} onChange={(e) => setPayLineKind(e.target.value as PayrollLineKind)}>
                        <option value="BASIC_SALARY">Basic salary</option>
                        <option value="ALLOWANCE">Allowance</option>
                        <option value="OVERTIME">Overtime</option>
                        <option value="COMMISSION">Commission</option>
                        <option value="TIP_SHARE">Tip share</option>
                        <option value="SERVICE_CHARGE_SHARE">Service charge share</option>
                        <option value="BONUS">Bonus</option>
                        <option value="ADJUSTMENT">Adjustment</option>
                        <option value="ADVANCE_RECOVERY">Advance recovery</option>
                        <option value="DEDUCTION">Deduction</option>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sd-pay-status">Status</Label>
                      <Select id="sd-pay-status" value={payStatus} onChange={(e) => setPayStatus(e.target.value as StaffCompensationStatus)}>
                        <option value="SCHEDULED">Scheduled</option>
                        <option value="APPROVED">Approved</option>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="sd-pay-label">Label</Label>
                      <Input id="sd-pay-label" value={payLabel} onChange={(e) => setPayLabel(e.target.value)} placeholder="Base salary, tip share, allowance…" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sd-pay-source">Source ref</Label>
                      <Input id="sd-pay-source" value={paySourceReference} onChange={(e) => setPaySourceReference(e.target.value)} placeholder="Order, booking, policy ref…" />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="sd-pay-amount">Amount</Label>
                      <Input id="sd-pay-amount" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sd-pay-currency">Currency</Label>
                      <Input id="sd-pay-currency" value={payCurrency} onChange={(e) => setPayCurrency(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="sd-pay-period">Period</Label>
                      <Input id="sd-pay-period" value={payPeriodLabel} onChange={(e) => setPayPeriodLabel(e.target.value)} placeholder="Apr 2026" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sd-pay-date">Effective date</Label>
                      <Input id="sd-pay-date" type="date" value={payEffectiveDate} onChange={(e) => setPayEffectiveDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sd-pay-branch">Branch</Label>
                    <Select id="sd-pay-branch" value={payBranchId} onChange={(e) => setPayBranchId(e.target.value)}>
                      <option value="">Use staff scope</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name ?? b.id.slice(0, 8)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sd-pay-notes">Notes</Label>
                    <Textarea id="sd-pay-notes" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Salary, allowance, deduction note…" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" disabled={pending} onClick={() => void onCreatePay()}>
                      {pending ? 'Saving…' : 'Create pay row'}
                    </Button>
                  </div>
                </div>

                {compensationRows.length ? (
                  <Table>
                    <thead>
                      <tr>
                        <Th>Line</Th>
                        <Th>Status</Th>
                        <Th>Amount</Th>
                        <Th>Slip</Th>
                        <Th>Date</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {compensationRows.map((row) => (
                        <tr key={row.id}>
                          <Td className="text-sm text-smoke-300">
                            <div className="font-medium text-smoke-400">{row.label || row.lineKind?.replaceAll('_', ' ') || row.type?.replaceAll('_', ' ') || 'Pay line'}</div>
                            <div className="text-xs text-smoke-200">{row.periodLabel || 'No period'}{row.sourceReference ? ` · ${row.sourceReference}` : ''}</div>
                          </Td>
                          <Td>{row.status ? <StatusChip status={row.status} /> : '—'}</Td>
                          <Td className="text-sm font-medium text-smoke-400">{formatMinorUnits(row.amountCents ?? 0)}</Td>
                          <Td className="text-xs text-smoke-200">{row.payrollSlipId ? 'On payslip' : row.lockedAt ? 'Locked' : 'Open'}</Td>
                          <Td className="text-xs text-smoke-200">
                            {row.effectiveDate ? new Date(row.effectiveDate).toLocaleDateString() : '—'}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <EmptyState
                    icon="ph:wallet-duotone"
                    title="No pay rows yet"
                    description="Create salary, bonus, commission, or deduction rows for this staff profile."
                  />
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
