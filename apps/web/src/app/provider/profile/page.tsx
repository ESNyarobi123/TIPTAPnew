'use client';

import { Icon } from '@iconify/react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { KeyValueList } from '@/components/ui/key-value-list';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusChip } from '@/components/ui/status-chip';
import { Textarea } from '@/components/ui/textarea';
import { me, type MeResponse } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import {
  getMyProviderProfile,
  upsertMyProviderProfile,
  type ProviderProfileInternal,
} from '@/lib/api/provider-registry';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';

const ROLE_LABEL: Record<string, string> = {
  SERVICE_STAFF: 'Service staff',
  CASHIER: 'Cashier',
  BRANCH_MANAGER: 'Branch manager',
  TENANT_OWNER: 'Owner',
  SUPPORT_AGENT: 'Support',
  SUPER_ADMIN: 'Platform admin',
};

function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function ProviderProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [account, setAccount] = useState<MeResponse | null>(null);
  const [profile, setProfile] = useState<ProviderProfileInternal | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [publicSlug, setPublicSlug] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('MOBILE_MONEY');
  const [payoutRecipientLabel, setPayoutRecipientLabel] = useState('');
  const [payoutAccountMask, setPayoutAccountMask] = useState('');
  const [payoutNote, setPayoutNote] = useState('');

  async function loadAll() {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [accountData, profileData] = await Promise.all([
        me(token),
        getMyProviderProfile(token).catch(() => null),
      ]);
      setAccount(accountData);
      setProfile(profileData);
      setDisplayName(profileData?.displayName ?? accountData.name ?? '');
      setHeadline(profileData?.headline ?? '');
      setBio(profileData?.bio ?? '');
      setSkills(Array.isArray(profileData?.skills) ? profileData.skills.join(', ') : '');
      setPublicSlug(profileData?.publicSlug ?? slugify(profileData?.displayName ?? accountData.name ?? ''));
      setPayoutMethod(profileData?.payoutProfile?.method ?? 'MOBILE_MONEY');
      setPayoutRecipientLabel(profileData?.payoutProfile?.recipientLabel ?? '');
      setPayoutAccountMask(profileData?.payoutProfile?.accountMask ?? '');
      setPayoutNote(profileData?.payoutProfile?.note ?? '');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const hasProviderIdentity = Boolean(profile?.id);
  const skillsCount = useMemo(
    () =>
      skills
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean).length,
    [skills],
  );

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const token = getStoredToken();
    if (!token) return;
    setSaving(true);
    try {
      const next = await upsertMyProviderProfile(token, {
        displayName,
        headline: headline || null,
        bio: bio || null,
        publicSlug: publicSlug || null,
        skills: skills
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        payoutMethod: payoutMethod || null,
        payoutRecipientLabel: payoutRecipientLabel || null,
        payoutAccountMask: payoutAccountMask || null,
        payoutNote: payoutNote || null,
      });
      setProfile(next);
      toast.success(next.registryCode ? `Saved. Your provider code is ${next.registryCode}` : 'Provider profile saved');
      await loadAll();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="personal"
        eyebrow="My identity"
        title="Provider profile"
        description="Your portable identity and provider code."
      />

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-48 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl lg:col-span-3" />
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="border-teal-900/10 bg-gradient-to-br from-teal-50/35 via-ivory-100/70 to-ivory-100 shadow-card lg:col-span-2">
              <CardHeader className="border-b border-smoke-400/[0.06]">
                <CardTitle className="flex items-center gap-2 font-display text-base">
                  <Icon icon="fluent-color:contact-card-48" className="h-5 w-5" aria-hidden />
                  Account
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <KeyValueList
                  rows={[
                    { label: 'Name', value: account?.name || '—' },
                    { label: 'Email', value: account?.email ?? '—' },
                    { label: 'Phone', value: account?.phone?.trim() ? account.phone : 'Not set' },
                    {
                      label: 'Status',
                      value: account?.isActive ? <StatusChip status="ACTIVE" /> : <StatusChip status="INACTIVE" />,
                    },
                  ]}
                />
              </CardContent>
            </Card>

            <Card className="border-smoke-400/10 shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon icon="fluent-color:person-starburst-48" className="h-5 w-5" aria-hidden />
                  Portable identity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-smoke-400/[0.07] bg-ivory-50/90 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Provider code</p>
                  <p className="mt-2 font-mono text-lg font-semibold text-smoke-400">
                    {profile?.registryCode ?? 'Not generated yet'}
                  </p>
                  <p className="mt-1 text-xs text-smoke-200">Share this with managers.</p>
                </div>
                <div className="rounded-2xl border border-smoke-400/[0.07] bg-ivory-50/90 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Public slug</p>
                  <p className="mt-2 font-mono text-sm text-smoke-400">
                    {profile?.publicSlug ? `/provider/${profile.publicSlug}` : 'Not set'}
                  </p>
                </div>
                <div className="rounded-2xl border border-smoke-400/[0.07] bg-ivory-50/90 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Skills</p>
                  <p className="mt-2 text-sm text-smoke-400">{skillsCount} tagged skill{skillsCount === 1 ? '' : 's'}</p>
                </div>
                <div className="rounded-2xl border border-smoke-400/[0.07] bg-ivory-50/90 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Payout</p>
                  <p className="mt-2 text-sm text-smoke-400">
                    {profile?.payoutProfile?.method?.replaceAll('_', ' ') ?? 'Not set'}
                  </p>
                  <p className="mt-1 text-xs text-smoke-200">
                    {profile?.payoutProfile?.accountMask ?? 'Add a masked destination for payroll'}
                  </p>
                </div>
                {!hasProviderIdentity ? (
                  <p className="rounded-xl border border-teal-900/10 bg-teal-50/30 p-3 text-xs text-smoke-200">
                    Save once to generate your provider code.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card className="border-smoke-400/10 shadow-card">
            <CardHeader className="border-b border-smoke-400/[0.06]">
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon icon="fluent-color:apps-48" className="h-5 w-5" aria-hidden />
                Edit profile
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={onSave} className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pp-display">Display name</Label>
                  <Input id="pp-display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-slug">Public slug</Label>
                  <Input id="pp-slug" value={publicSlug} onChange={(e) => setPublicSlug(slugify(e.target.value))} placeholder="e.g. erick-salehe" />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="pp-headline">Headline</Label>
                  <Input
                    id="pp-headline"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="e.g. Barber, braider, masseuse, waiter…"
                  />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="pp-skills">Skills</Label>
                  <Input
                    id="pp-skills"
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder="Fade, braids, facial, service floor, massage…"
                  />
                  <p className="text-xs text-smoke-200">Use commas.</p>
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="pp-bio">Short bio</Label>
                  <Textarea
                    id="pp-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="What should businesses and customers know about your style or service strengths?"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-payout-method">Payout method</Label>
                  <Select id="pp-payout-method" value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)}>
                    <option value="MOBILE_MONEY">Mobile money</option>
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="MANUAL_OTHER">Manual other</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-payout-recipient">Recipient label</Label>
                  <Input
                    id="pp-payout-recipient"
                    value={payoutRecipientLabel}
                    onChange={(e) => setPayoutRecipientLabel(e.target.value)}
                    placeholder="Name used during payout"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-payout-mask">Account / phone mask</Label>
                  <Input
                    id="pp-payout-mask"
                    value={payoutAccountMask}
                    onChange={(e) => setPayoutAccountMask(e.target.value)}
                    placeholder="+2557***123 or ****9821"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-payout-note">Payout note</Label>
                  <Input
                    id="pp-payout-note"
                    value={payoutNote}
                    onChange={(e) => setPayoutNote(e.target.value)}
                    placeholder="Optional payroll routing note"
                  />
                </div>
                <div className="flex flex-wrap gap-2 lg:col-span-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save provider profile'}
                  </Button>
                  <Button type="button" variant="outline" disabled={saving} onClick={() => void loadAll()}>
                    Refresh
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-smoke-400/10 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon icon="fluent-color:building-people-24" className="h-5 w-5" aria-hidden />
                Roles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {account?.roles?.length ? (
                <ul className="space-y-2">
                  {account.roles.map((r, i) => (
                    <li
                      key={`${r.role}-${r.tenantId ?? 'na'}-${r.branchId ?? 'na'}-${i}`}
                      className="rounded-xl border border-smoke-400/[0.07] bg-ivory-50/90 px-3 py-2.5 text-sm"
                    >
                      <span className="font-medium text-smoke-400">
                        {ROLE_LABEL[r.role] ?? r.role.replace(/_/g, ' ')}
                      </span>
                      <div className="mt-1 space-y-0.5 text-xs text-smoke-200">
                        {r.tenantId ? <p>Tenant · {r.tenantId.slice(0, 8)}…</p> : null}
                        {r.branchId ? <p>Branch · {r.branchId.slice(0, 8)}…</p> : null}
                        {!r.tenantId && !r.branchId ? <p className="italic">Platform-scoped role</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-smoke-200">No linked roles yet.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
