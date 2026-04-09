'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MetricMini } from '@/components/ui/metric-mini';
import { SectionHeader } from '@/components/ui/section-header';
import { Select } from '@/components/ui/select';
import { EntityQrCard } from '@/components/workspace/entity-qr-card';
import { ApiError } from '@/lib/api/client';
import {
  createStaff,
  createStaffJoinInvite,
  listStaff,
  listStaffJoinInvites,
  revokeStaffJoinInvite,
} from '@/lib/api/staff';
import { createQr, listQr, rotateQr, type QrMutationResult, type QrRecord } from '@/lib/api/qr';
import { getStoredToken } from '@/lib/auth/storage';
import {
  buildLaunchPageUrl,
  cacheQrLaunchPack,
  copyTextToClipboard,
  downloadQrSvgAsset,
  listCachedQrLaunchPacks,
  whatsappDeepLink,
} from '@/lib/qr-launch';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

type StaffRow = {
  id: string;
  displayName?: string;
  roleInTenant?: string;
  status?: string;
  email?: string | null;
  phone?: string | null;
  branchId?: string | null;
  publicHandle?: string | null;
  providerRegistryCode?: string | null;
};

function asRow(x: unknown): StaffRow {
  const o = (x ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    displayName: typeof o.displayName === 'string' ? o.displayName : undefined,
    roleInTenant: typeof o.roleInTenant === 'string' ? o.roleInTenant : undefined,
    status: typeof o.status === 'string' ? o.status : undefined,
    email: typeof o.email === 'string' ? o.email : (o.email === null ? null : undefined),
    phone: typeof o.phone === 'string' ? o.phone : (o.phone === null ? null : undefined),
    branchId: typeof o.branchId === 'string' ? o.branchId : (o.branchId === null ? null : undefined),
    publicHandle: typeof o.publicHandle === 'string' ? o.publicHandle : (o.publicHandle === null ? null : undefined),
    providerRegistryCode:
      typeof o.providerRegistryCode === 'string'
        ? o.providerRegistryCode
        : (o.providerRegistryCode === null ? null : undefined),
  };
}

const roles = ['SERVICE_STAFF', 'CASHIER', 'BRANCH_MANAGER', 'SUPPORT_AGENT'] as const;

function humanizeRole(value?: string | null) {
  return (value ?? 'SERVICE_STAFF').replaceAll('_', ' ');
}

function safeFileToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tiptap';
}

function pickLatestQr(rows: QrRecord[]) {
  return [...rows].sort((a, b) => {
    const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
    const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
    const aRank = a.status === 'ACTIVE' ? 1 : 0;
    const bRank = b.status === 'ACTIVE' ? 1 : 0;
    return bRank - aRank || bTime - aTime;
  })[0] ?? null;
}

export default function StaffIndexPage() {
  const { tenantId, branchId, branches } = useScope();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [qrRows, setQrRows] = useState<QrRecord[]>([]);
  const [launchPacks, setLaunchPacks] = useState<Record<string, QrMutationResult>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [qrPendingId, setQrPendingId] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | (typeof roles)[number]>('ALL');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [publicHandle, setPublicHandle] = useState('');
  const [roleInTenant, setRoleInTenant] = useState<(typeof roles)[number]>('SERVICE_STAFF');
  const [inviteBranchId, setInviteBranchId] = useState('');
  const [invites, setInvites] = useState<
    { id: string; code: string; branch: { name: string }; maxUses: number; usesCount: number; expiresAt: string | null; revokedAt: string | null }[]
  >([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [invitePending, setInvitePending] = useState(false);
  const [lastGeneratedCode, setLastGeneratedCode] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  const canCreate = useMemo(() => Boolean(tenantId), [tenantId]);
  const branchNameById = useMemo(
    () =>
      new Map(
        branches.map((branch) => [branch.id, branch.name ?? branch.id.slice(0, 8)]),
      ),
    [branches],
  );

  useEffect(() => {
    setOrigin(window.location.origin);
    setLaunchPacks(listCachedQrLaunchPacks());
  }, []);

  async function refresh() {
    const token = getStoredToken();
    if (!token || !tenantId) {
      setRows([]);
      setQrRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [staffList, qrList] = await Promise.all([listStaff(token, tenantId), listQr(token, tenantId)]);
      setRows((Array.isArray(staffList) ? staffList : []).map(asRow).filter((row) => row.id));
      setQrRows(Array.isArray(qrList) ? qrList : []);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    if (branchId) {
      setInviteBranchId((prev) => prev || branchId);
    } else if (branches[0]?.id) {
      setInviteBranchId((prev) => prev || branches[0]!.id);
    }
  }, [branchId, branches]);

  async function refreshInvites() {
    const token = getStoredToken();
    if (!token || !tenantId) {
      setInvites([]);
      return;
    }
    setInviteLoading(true);
    try {
      const list = await listStaffJoinInvites(token, tenantId);
      setInvites(Array.isArray(list) ? list : []);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load join codes');
    } finally {
      setInviteLoading(false);
    }
  }

  useEffect(() => {
    void refreshInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function onGenerateJoinCode() {
    const token = getStoredToken();
    if (!token || !tenantId || !inviteBranchId) {
      toast.error('Select a branch first');
      return;
    }
    setInvitePending(true);
    try {
      const res = await createStaffJoinInvite(token, {
        tenantId,
        branchId: inviteBranchId,
        maxUses: 1,
        expiresInHours: 168,
      });
      setLastGeneratedCode(res.code);
      toast.success('Join code created — share it with your teammate');
      await refreshInvites();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not create join code');
    } finally {
      setInvitePending(false);
    }
  }

  async function onRevokeInvite(id: string) {
    const token = getStoredToken();
    if (!token) return;
    setInvitePending(true);
    try {
      await revokeStaffJoinInvite(token, id);
      toast.success('Join code revoked');
      await refreshInvites();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Revoke failed');
    } finally {
      setInvitePending(false);
    }
  }

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesRole = roleFilter === 'ALL' || row.roleInTenant === roleFilter;
      const matchesSearch =
        !needle ||
        row.displayName?.toLowerCase().includes(needle) ||
        row.email?.toLowerCase().includes(needle) ||
        row.phone?.toLowerCase().includes(needle) ||
        row.publicHandle?.toLowerCase().includes(needle);
      return Boolean(matchesRole && matchesSearch);
    });
  }, [query, roleFilter, rows]);

  const staffQrMap = useMemo(() => {
    const grouped = new Map<string, QrRecord[]>();
    for (const row of qrRows) {
      if (row.type !== 'STAFF_QR' || !row.staffId) {
        continue;
      }
      const bucket = grouped.get(row.staffId) ?? [];
      bucket.push(row);
      grouped.set(row.staffId, bucket);
    }
    return new Map(Array.from(grouped.entries()).map(([staffId, entries]) => [staffId, pickLatestQr(entries)]));
  }, [qrRows]);

  const activeCount = rows.filter((row) => row.status === 'ACTIVE').length;
  const inactiveCount = rows.filter((row) => row.status && row.status !== 'ACTIVE').length;
  const handleCount = rows.filter((row) => Boolean(row.publicHandle)).length;
  const branchLinkedCount = rows.filter((row) => Boolean(row.branchId)).length;

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    const token = getStoredToken();
    if (!token || !tenantId) {
      return;
    }
    setPending(true);
    try {
      await createStaff(token, {
        tenantId,
        branchId: branchId ?? null,
        displayName,
        email: email || null,
        phone: phone || null,
        publicHandle: publicHandle || null,
        roleInTenant,
      });
      toast.success('Staff created');
      setDisplayName('');
      setEmail('');
      setPhone('');
      setPublicHandle('');
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Create failed');
    } finally {
      setPending(false);
    }
  }

  async function handleQrMutation(row: StaffRow) {
    const token = getStoredToken();
    if (!token || !tenantId) {
      return;
    }
    const existingQr = staffQrMap.get(row.id) ?? null;
    setQrPendingId(row.id);
    try {
      const launchPack = existingQr
        ? await rotateQr(token, existingQr.id)
        : await createQr(token, {
            tenantId,
            branchId: row.branchId ?? null,
            type: 'STAFF_QR',
            staffId: row.id,
          });
      cacheQrLaunchPack(launchPack);
      setLaunchPacks((current) => ({ ...current, [launchPack.id]: launchPack }));
      toast.success(existingQr ? 'Staff QR refreshed' : 'Staff QR generated');
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not prepare staff QR');
    } finally {
      setQrPendingId('');
    }
  }

  async function handleCopyLaunch(row: StaffRow) {
    const qr = staffQrMap.get(row.id) ?? null;
    const launchPack = qr ? launchPacks[qr.id] ?? null : null;
    const prefillText = launchPack?.customerLaunch?.prefillText;
    if (!prefillText) {
      toast.error('Refresh this QR first to load the launch text');
      return;
    }
    const result = await copyTextToClipboard(prefillText, 'WhatsApp text');
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  }

  async function handleDownloadQr(row: StaffRow) {
    const qr = staffQrMap.get(row.id) ?? null;
    const launchPack = qr ? launchPacks[qr.id] ?? null : null;
    const launchUrl = launchPack ? buildLaunchPageUrl(origin, launchPack) : null;
    if (!launchUrl || !qr) {
      toast.error('Refresh this QR first to load the printable QR');
      return;
    }
    try {
      await downloadQrSvgAsset(launchUrl, `${safeFileToken(row.displayName ?? row.id)}-${qr.publicRef}`);
      toast.success('QR downloaded');
    } catch {
      toast.error('Could not download QR');
    }
  }

  function handleOpenLaunch(row: StaffRow) {
    const qr = staffQrMap.get(row.id) ?? null;
    const launchPack = qr ? launchPacks[qr.id] ?? null : null;
    const launchUrl = launchPack ? buildLaunchPageUrl(origin, launchPack) : null;
    if (!launchUrl) {
      toast.error('Refresh this QR first to load the launch page');
      return;
    }
    window.open(launchUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        eyebrow="Operations"
        title="Staff and providers"
        description="Create staff, link providers, and manage QR cards."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/staff/link">Link provider code</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/qr?type=STAFF_QR&scope=branch">Create staff QR</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricMini icon="fluent-color:contact-card-48" label="Active staff" value={activeCount} hint="Ready" />
        <MetricMini icon="fluent-color:alert-24" label="Inactive staff" value={inactiveCount} hint="Paused" />
        <MetricMini icon="fluent-color:person-starburst-48" label="Public handles" value={handleCount} hint="Guest-facing" />
        <MetricMini icon="fluent-color:building-people-24" label="Branch-linked" value={branchLinkedCount} hint="Assigned" />
      </div>

      {!tenantId ? (
        <EmptyState
          icon="ph:users-three-duotone"
          title="Select a tenant"
          description="Choose a tenant in the header to list staff, create new profiles, and manage assignments."
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.9fr)] xl:items-start">
          <Card className="border-smoke-400/10 shadow-card">
            <CardHeader className="border-b border-smoke-400/[0.06] pb-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle className="text-lg">Team QR roster</CardTitle>
                  <p className="mt-2 text-[13px] text-smoke-200">Create, refresh, and view staff QR cards in one grid.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="staff-search">Search</Label>
                    <Input
                      id="staff-search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search staff, phone, email, handle…"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-role-filter">Role</Label>
                    <Select
                      id="staff-role-filter"
                      value={roleFilter}
                      onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}
                    >
                      <option value="ALL">All roles</option>
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              {loading ? (
                <p className="text-sm text-smoke-200">Loading roster…</p>
              ) : filteredRows.length ? (
                <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                  {filteredRows.map((row) => {
                    const branchLabel = row.branchId
                      ? branchNameById.get(row.branchId) ?? row.branchId.slice(0, 8)
                      : 'Tenant-wide';
                    const qr = staffQrMap.get(row.id) ?? null;
                    const launchPack = qr ? launchPacks[qr.id] ?? null : null;
                    const launchPageUrl = launchPack ? buildLaunchPageUrl(origin, launchPack) : null;
                    const launchLink = launchPack?.customerLaunch?.prefillText
                      ? whatsappDeepLink(launchPack.customerLaunch.prefillText)
                      : null;
                    const identityLabel =
                      row.providerRegistryCode ?? (row.publicHandle ? `@${row.publicHandle}` : row.email ?? 'No public code yet');

                    return (
                      <EntityQrCard
                        key={row.id}
                        tone="staff"
                        variant="compact"
                        title={row.displayName ?? row.id.slice(0, 8)}
                        subtitle={`${humanizeRole(row.roleInTenant)} · ${branchLabel}`}
                        code={identityLabel}
                        qrLabel={qr ? qr.publicRef : 'No QR issued'}
                        qrValue={launchPageUrl}
                        previewReady={Boolean(launchPageUrl)}
                        previewHint={
                          launchPageUrl
                            ? 'Scan to launch the WhatsApp flow for this staff member.'
                            : 'Generate or refresh this QR to load its launch preview here.'
                        }
                        statusLabel={row.status === 'ACTIVE' ? 'Active' : (row.status ?? 'Draft')}
                        metrics={[
                          {
                            label: 'Scans',
                            value: String(qr?.scanCount ?? 0),
                            hint: qr?.lastScannedAt ? new Date(qr.lastScannedAt).toLocaleDateString() : 'No scans yet',
                          },
                          {
                            label: 'Scope',
                            value: row.branchId ? 'Branch' : 'Tenant',
                            hint: branchLabel,
                          },
                          {
                            label: 'Contact',
                            value: row.phone ?? row.email ?? 'Pending',
                            hint: row.publicHandle ? `@${row.publicHandle}` : 'No handle yet',
                          },
                        ]}
                        actions={[
                          {
                            key: 'generate',
                            label: qr ? 'Refresh QR' : 'Generate QR',
                            icon: qr ? 'fluent-color:arrow-sync-circle-24' : 'fluent-color:qr-code-24',
                            onClick: () => void handleQrMutation(row),
                            disabled: qrPendingId === row.id,
                            variant: 'primary',
                          },
                          {
                            key: 'download',
                            label: 'Download',
                            icon: 'fluent-color:arrow-download-24',
                            onClick: () => void handleDownloadQr(row),
                            disabled: !launchPageUrl || qrPendingId === row.id,
                            variant: 'outline',
                          },
                          {
                            key: 'copy',
                            label: 'Copy text',
                            icon: 'fluent-color:document-one-page-copy-24',
                            onClick: () => void handleCopyLaunch(row),
                            disabled: !launchPack?.customerLaunch?.prefillText || qrPendingId === row.id,
                            variant: 'ghost',
                          },
                          launchLink
                            ? {
                                key: 'open',
                                label: 'Open launch',
                                icon: 'fluent-color:open-24',
                                onClick: () => handleOpenLaunch(row),
                                disabled: qrPendingId === row.id,
                                variant: 'ghost',
                              }
                            : {
                                key: 'desk',
                                label: 'QR desk',
                                icon: 'fluent-color:panel-left-contract-20',
                                href: `/dashboard/qr?type=STAFF_QR&staffId=${encodeURIComponent(row.id)}&scope=${row.branchId ? 'branch' : 'tenant'}`,
                                variant: 'ghost',
                              },
                          {
                            key: 'profile',
                            label: 'Open profile',
                            icon: 'fluent-color:person-info-20',
                            href: `/dashboard/staff/${encodeURIComponent(row.id)}`,
                            variant: 'ghost',
                          },
                        ]}
                      />
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon="ph:users-three-duotone"
                  title={rows.length ? 'No staff match this filter' : 'No staff yet'}
                  description={
                    rows.length
                      ? 'Adjust your search or role filter to see more team members.'
                      : 'Create the first staff record on the right, then open the profile to manage assignments and QR shortcuts.'
                  }
                />
              )}
            </CardContent>
          </Card>

          <div className="flex min-w-0 flex-col gap-6">
          <Card className="border-smoke-400/10 bg-gradient-to-br from-ivory-100 via-ivory-50 to-emerald-50/30 shadow-card">
              <CardHeader className="border-b border-smoke-400/[0.06] pb-5">
                <CardTitle className="text-lg">Create staff</CardTitle>
              <p className="text-[13px] text-smoke-200">New records inherit the selected branch.</p>
              </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={onCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="s-name">Display name</Label>
                  <Input id="s-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-role">Role in tenant</Label>
                  <Select
                    id="s-role"
                    value={roleInTenant}
                    onChange={(event) => setRoleInTenant(event.target.value as typeof roleInTenant)}
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="s-email">Email</Label>
                    <Input id="s-email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Optional" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s-phone">Phone</Label>
                    <Input id="s-phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Optional" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-handle">Public handle</Label>
                  <Input
                    id="s-handle"
                    value={publicHandle}
                    onChange={(event) => setPublicHandle(event.target.value)}
                    placeholder="e.g. erick-salehe"
                  />
                  <p className="text-xs text-smoke-200">Short and public.</p>
                </div>
                <div className="rounded-2xl border border-smoke-400/10 bg-white/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-smoke-200">What happens next</p>
                  <div className="mt-3 space-y-2 text-sm text-smoke-300">
                    <div>1. Save.</div>
                    <div>2. Open profile.</div>
                    <div>3. Generate QR.</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={!canCreate || pending}>
                    {pending ? 'Creating…' : 'Create staff'}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
                    Refresh list
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-smoke-400/10 shadow-card">
            <CardHeader className="border-b border-smoke-400/[0.06] pb-5">
              <CardTitle className="text-lg">Self-serve join codes</CardTitle>
              <p className="text-[13px] text-smoke-200">
                Providers redeem in onboarding (Join a business). Codes default to 7-day expiry and single use.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="space-y-2">
                <Label htmlFor="invite-branch">Branch for invite</Label>
                <Select
                  id="invite-branch"
                  value={inviteBranchId}
                  onChange={(e) => setInviteBranchId(e.target.value)}
                  disabled={!branches.length}
                >
                  <option value="">{branches.length ? 'Select branch' : 'No branches'}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name ?? b.id.slice(0, 8)}
                    </option>
                  ))}
                </Select>
              </div>
              {lastGeneratedCode ? (
                <div className="rounded-2xl border border-amber-200/40 bg-amber-50/80 px-4 py-3 text-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-900/70">Latest code</p>
                  <p className="mt-1 font-mono text-base font-semibold text-smoke-400">{lastGeneratedCode}</p>
                </div>
              ) : null}
              <Button type="button" size="sm" disabled={!tenantId || !inviteBranchId || invitePending} onClick={() => void onGenerateJoinCode()}>
                {invitePending ? 'Working…' : 'Generate join code'}
              </Button>
              <div className="border-t border-smoke-400/[0.08] pt-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Recent codes</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => void refreshInvites()} disabled={inviteLoading}>
                    Refresh
                  </Button>
                </div>
                {inviteLoading ? (
                  <p className="text-sm text-smoke-200">Loading…</p>
                ) : invites.length === 0 ? (
                  <p className="text-sm text-smoke-200">No codes yet for this business.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {invites.slice(0, 8).map((inv) => (
                      <li
                        key={inv.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-smoke-400/10 bg-ivory-50/80 px-3 py-2"
                      >
                        <span>
                          <span className="font-mono font-medium text-smoke-400">{inv.code}</span>
                          <span className="ml-2 text-xs text-smoke-200">
                            {inv.branch.name} · {inv.usesCount}/{inv.maxUses}
                            {inv.revokedAt ? ' · revoked' : ''}
                          </span>
                        </span>
                        {!inv.revokedAt ? (
                          <Button type="button" variant="outline" size="sm" disabled={invitePending} onClick={() => void onRevokeInvite(inv.id)}>
                            Revoke
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      )}
    </div>
  );
}
