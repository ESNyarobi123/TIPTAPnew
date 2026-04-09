'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, Td, Th } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import { lookupProviderProfile, type ProviderProfileLookup } from '@/lib/api/provider-registry';
import { bulkCreateStaff, createAssignment, linkProviderProfile, searchStaff, type StaffAssignmentMode } from '@/lib/api/staff';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

type StaffRow = {
  id: string;
  displayName?: string;
  roleInTenant?: string;
  status?: string;
  phone?: string | null;
  publicHandle?: string | null;
};

function asRow(x: unknown): StaffRow {
  const o = (x ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    displayName: typeof o.displayName === 'string' ? o.displayName : undefined,
    roleInTenant: typeof o.roleInTenant === 'string' ? o.roleInTenant : undefined,
    status: typeof o.status === 'string' ? o.status : undefined,
    phone: typeof o.phone === 'string' ? o.phone : (o.phone === null ? null : undefined),
    publicHandle: typeof o.publicHandle === 'string' ? o.publicHandle : (o.publicHandle === null ? null : undefined),
  };
}

export default function StaffBulkLinkPage() {
  const { tenantId, branches } = useScope();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [branchId, setBranchId] = useState('');
  const [mode, setMode] = useState<StaffAssignmentMode>('PART_TIME_SHARED');
  const [bulkLines, setBulkLines] = useState('');
  const [bulkPending, setBulkPending] = useState(false);
  const [providerCode, setProviderCode] = useState('');
  const [providerLookupPending, setProviderLookupPending] = useState(false);
  const [providerLinkPending, setProviderLinkPending] = useState(false);
  const [providerPreview, setProviderPreview] = useState<ProviderProfileLookup | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token || !tenantId) {
      setRows([]);
      return;
    }
    const needle = q.trim();
    if (needle.length < 2) {
      setRows([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      searchStaff(token, { tenantId, q: needle })
        .then((r) => setRows((Array.isArray(r) ? r : []).map(asRow).filter((x) => x.id)))
        .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Search failed'))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, tenantId]);

  const canLink = useMemo(() => Boolean(tenantId && branchId), [tenantId, branchId]);

  async function linkStaff(staffId: string) {
    const token = getStoredToken();
    if (!token || !canLink) return;
    setPendingId(staffId);
    try {
      await createAssignment(token, staffId, { branchId, mode });
      toast.success('Staff linked to branch');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Link failed');
    } finally {
      setPendingId(null);
    }
  }

  async function runBulkCreate() {
    const token = getStoredToken();
    if (!token || !tenantId || !branchId) return;
    setBulkPending(true);
    try {
      const res = (await bulkCreateStaff(token, {
        tenantId,
        branchId,
        mode,
        lines: bulkLines,
      })) as any;
      const created = Array.isArray(res?.created) ? res.created.length : 0;
      const linked = Array.isArray(res?.linked) ? res.linked.length : 0;
      const skipped = Array.isArray(res?.skipped) ? res.skipped.length : 0;
      toast.success(`Done: ${created} created, ${linked} linked, ${skipped} skipped`);
      setBulkLines('');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Bulk create failed');
    } finally {
      setBulkPending(false);
    }
  }

  async function previewProvider() {
    const token = getStoredToken();
    if (!token || providerCode.trim().length < 3) return;
    setProviderLookupPending(true);
    try {
      const found = await lookupProviderProfile(token, providerCode.trim());
      setProviderPreview(found);
      toast.success('Provider found');
    } catch (e) {
      setProviderPreview(null);
      toast.error(e instanceof ApiError ? e.message : 'Provider lookup failed');
    } finally {
      setProviderLookupPending(false);
    }
  }

  async function linkByProviderCode() {
    const token = getStoredToken();
    if (!token || !tenantId || !branchId || providerCode.trim().length < 3) return;
    setProviderLinkPending(true);
    try {
      const res = (await linkProviderProfile(token, {
        tenantId,
        branchId,
        providerCode: providerCode.trim(),
        mode,
      })) as { staff?: { id?: string; displayName?: string }; provider?: { registryCode?: string | null } };
      toast.success(
        `Provider linked${res.provider?.registryCode ? ` (${res.provider.registryCode})` : ''}${res.staff?.displayName ? ` · ${res.staff.displayName}` : ''}`,
      );
      setProviderCode('');
      setProviderPreview(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Provider link failed');
    } finally {
      setProviderLinkPending(false);
    }
  }

  if (!tenantId) {
    return (
      <EmptyState
        variant="premium"
        icon="ph:buildings-duotone"
        title="Select a tenant"
        description="Choose an organization in the header to bulk-link staff to branches."
      />
    );
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="business"
        eyebrow="Staff"
        title="Link staff to branch"
        description="Search by phone, handle, email, or name — then link staff to a branch with a permanent or temporary mode."
      />

      <Card className="border-smoke-400/10 shadow-card">
        <CardHeader className="border-b border-smoke-400/[0.06]">
          <CardTitle className="text-base">Link settings</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <FilterBar>
            <div className="space-y-1">
              <Label htmlFor="sl-branch">Branch</Label>
              <Select id="sl-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Select branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name ?? b.id.slice(0, 8)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sl-mode">Mode</Label>
              <Select id="sl-mode" value={mode} onChange={(e) => setMode(e.target.value as StaffAssignmentMode)}>
                <option value="FULL_TIME_EXCLUSIVE">Permanent (exclusive)</option>
                <option value="PART_TIME_SHARED">Part-time (shared)</option>
                <option value="SHIFT_BASED">Shift-based</option>
                <option value="TEMPORARY_CONTRACT">Temporary contract</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sl-q">Search staff</Label>
              <Input
                id="sl-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="phone, handle, email, or name…"
                className="h-10 min-w-[18rem]"
              />
            </div>
            <div className="ml-auto text-xs text-smoke-200">
              Tip: open full profile from <Link className="font-medium text-violet-900 hover:underline" href="/dashboard/staff">Staff list</Link>
            </div>
          </FilterBar>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Card className="border-smoke-400/10 shadow-soft">
              <CardHeader className="border-b border-smoke-400/[0.06]">
                <CardTitle className="text-base">Link by provider code</CardTitle>
              </CardHeader>
              <CardContent className="pt-5 space-y-3">
                <p className="text-sm text-smoke-200">
                  Use the provider&apos;s portable TIPTAP code or public slug. TIPTAP will create a staff row if needed,
                  then assign that provider to the selected branch.
                </p>
                <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <Input
                    value={providerCode}
                    onChange={(e) => setProviderCode(e.target.value)}
                    placeholder="e.g. TIP-PA1B2C3 or erick-salehe"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canLink || providerLookupPending || providerCode.trim().length < 3}
                    onClick={() => void previewProvider()}
                  >
                    {providerLookupPending ? 'Checking…' : 'Find provider'}
                  </Button>
                  <Button
                    type="button"
                    disabled={!canLink || providerLinkPending || providerCode.trim().length < 3}
                    onClick={() => void linkByProviderCode()}
                  >
                    {providerLinkPending ? 'Linking…' : 'Link provider'}
                  </Button>
                </div>
                {providerPreview ? (
                  <div className="rounded-2xl border border-smoke-400/[0.06] bg-ivory-100/60 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-smoke-200">Matched provider</p>
                    <p className="mt-2 font-display text-lg font-semibold text-smoke-400">{providerPreview.displayName}</p>
                    <p className="mt-1 text-xs font-mono text-smoke-200">
                      {providerPreview.registryCode ?? providerPreview.publicSlug ?? 'No code'}
                    </p>
                    {providerPreview.headline ? (
                      <p className="mt-2 text-sm text-smoke-200">{providerPreview.headline}</p>
                    ) : null}
                    {providerPreview.skills?.length ? (
                      <p className="mt-2 text-xs text-smoke-200">{providerPreview.skills.slice(0, 8).join(', ')}</p>
                    ) : null}
                    {providerPreview.employmentSummary ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border border-smoke-400/[0.06] bg-white/70 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-smoke-200">Linked businesses</p>
                          <p className="mt-1 text-sm font-semibold text-smoke-400">
                            {providerPreview.employmentSummary.linkedBusinesses}
                          </p>
                        </div>
                        <div className="rounded-xl border border-smoke-400/[0.06] bg-white/70 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-smoke-200">Active assignments</p>
                          <p className="mt-1 text-sm font-semibold text-smoke-400">
                            {providerPreview.employmentSummary.activeAssignments}
                          </p>
                        </div>
                      </div>
                    ) : null}
                    {providerPreview.employmentHistory?.length ? (
                      <div className="mt-3 space-y-2">
                        {providerPreview.employmentHistory.slice(0, 3).map((row) => (
                          <div
                            key={row.staffId}
                            className="rounded-xl border border-smoke-400/[0.06] bg-white/70 px-3 py-2"
                          >
                            <p className="text-sm font-semibold text-smoke-400">
                              {row.tenantName ?? 'Business'}
                              {row.branchName ? ` · ${row.branchName}` : ''}
                            </p>
                            <p className="mt-1 text-xs text-smoke-200">
                              {row.roleInTenant.replaceAll('_', ' ')} · {row.status}
                              {row.lastAssignmentMode ? ` · ${row.lastAssignmentMode.replaceAll('_', ' ')}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-smoke-400/10 shadow-soft">
              <CardHeader className="border-b border-smoke-400/[0.06]">
                <CardTitle className="text-base">Bulk create + link</CardTitle>
              </CardHeader>
              <CardContent className="pt-5 space-y-3">
                <p className="text-sm text-smoke-200">
                  Paste one staff per line. Examples:
                  <span className="ml-2 font-mono text-xs">Asha, +255712345678</span> or{' '}
                  <span className="font-mono text-xs">+255712345678</span>
                </p>
                <Textarea
                  value={bulkLines}
                  onChange={(e) => setBulkLines(e.target.value)}
                  placeholder="Name, phone\nPhone\nName phone…"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={!canLink || bulkPending || bulkLines.trim().length < 3}
                    onClick={() => void runBulkCreate()}
                  >
                    {bulkPending ? 'Processing…' : 'Bulk create + link'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {loading ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              variant="premium"
              icon="ph:magnifying-glass-duotone"
              title="Search staff"
              description="Type at least 2 characters to search. Results will appear here."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Phone</Th>
                  <Th>Handle</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td className="font-medium text-smoke-400">{r.displayName ?? r.id.slice(0, 8)}</Td>
                    <Td className="font-mono text-xs">{r.roleInTenant ?? '—'}</Td>
                    <Td className="text-xs text-smoke-200">{r.status ?? '—'}</Td>
                    <Td className="text-xs text-smoke-200">{r.phone ?? '—'}</Td>
                    <Td className="font-mono text-xs">{r.publicHandle ?? '—'}</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/dashboard/staff/${encodeURIComponent(r.id)}`}>Open</Link>
                        </Button>
                        <Button
                          size="sm"
                          disabled={!canLink || pendingId === r.id}
                          onClick={() => void linkStaff(r.id)}
                        >
                          {pendingId === r.id ? 'Linking…' : 'Link'}
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
