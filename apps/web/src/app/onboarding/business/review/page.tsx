'use client';

import Link from 'next/link';
import { Icon } from '@iconify/react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import { WizardShell, type WizardStep } from '@/components/onboarding/wizard-shell';
import { me } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { createBranchForTenant, createSelfServeBusinessWorkspace, upsertTenantCategory } from '@/lib/api/onboarding';
import { listTenants } from '@/lib/api/tenants-branches';
import { getStoredToken } from '@/lib/auth/storage';
import { clearBusinessDraft, loadBusinessDraft } from '@/lib/onboarding/storage';
import { toast } from '@/lib/toast';
import { replaceToWorkspaceFromToken } from '@/lib/auth/workspace';

const steps: WizardStep[] = [
  { key: 'account', label: 'Account', href: '/onboarding/business/account' },
  { key: 'details', label: 'Business details', href: '/onboarding/business/details' },
  { key: 'category', label: 'Category', href: '/onboarding/business/category' },
  { key: 'subtype', label: 'Subtype', href: '/onboarding/business/subtype' },
  { key: 'branch', label: 'First branch', href: '/onboarding/business/branch' },
  { key: 'review', label: 'Review', href: '/onboarding/business/review' },
];

type TenantRow = { id: string; name?: string };

export default function BusinessReviewStep() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [tenantId, setTenantId] = useState<string>('');
  const [pending, setPending] = useState(false);
  const [creating, setCreating] = useState(false);

  const draft = useMemo(() => loadBusinessDraft(), []);
  const token = typeof window !== 'undefined' ? getStoredToken() : null;

  useEffect(() => {
    const t = getStoredToken();
    if (!t) return;
    Promise.all([me(t), listTenants(t)])
      .then(([, raw]) => {
        const rows: TenantRow[] = Array.isArray(raw)
          ? (raw as Record<string, unknown>[]).map((r) => ({
              id: String(r.id),
              name: typeof r.name === 'string' ? r.name : undefined,
            }))
          : [];
        setTenants(rows);
        if (rows.length === 1) setTenantId(rows[0].id);
      })
      .catch(() => {
        setTenants([]);
      });
  }, []);

  const canApply = Boolean(token && tenantId && draft.category && draft.branch?.name && draft.branch?.code);
  const canCreateWorkspace = Boolean(token && draft.business?.name && draft.category && draft.branch?.name && draft.branch?.code);

  async function apply() {
    const t = getStoredToken();
    if (!t || !tenantId) return;
    if (!draft.category) return;
    setPending(true);
    try {
      await upsertTenantCategory(t, tenantId, { category: draft.category, enabled: true, settings: { subtype: draft.subtype ?? null } });
      await createBranchForTenant(t, tenantId, {
        name: draft.branch?.name,
        code: draft.branch?.code,
        address: draft.branch?.address || undefined,
        city: draft.branch?.city || undefined,
        country: draft.branch?.country || undefined,
        phone: draft.branch?.phone || undefined,
        email: draft.branch?.email || undefined,
        timezone: draft.branch?.timezone || undefined,
      });
      toast.success('Workspace configured');
      clearBusinessDraft();
      await replaceToWorkspaceFromToken(router, t);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not apply configuration');
    } finally {
      setPending(false);
    }
  }

  async function createWorkspace() {
    const t = getStoredToken();
    if (!t || !draft.category || !draft.business?.name || !draft.branch?.name || !draft.branch?.code) {
      return;
    }
    setCreating(true);
    try {
      await createSelfServeBusinessWorkspace(t, {
        name: draft.business.name,
        brandName: draft.business.brandName || undefined,
        phone: draft.business.phone || undefined,
        businessEmail: draft.business.businessEmail || undefined,
        country: draft.business.country || undefined,
        city: draft.business.city || undefined,
        address: draft.business.address || undefined,
        category: draft.category,
        subtype: draft.subtype || undefined,
        branch: {
          name: draft.branch.name,
          code: draft.branch.code,
          address: draft.branch.address || undefined,
          city: draft.branch.city || undefined,
          country: draft.branch.country || undefined,
          phone: draft.branch.phone || undefined,
          email: draft.branch.email || undefined,
          timezone: draft.branch.timezone || undefined,
        },
      });
      toast.success('Workspace created');
      clearBusinessDraft();
      await replaceToWorkspaceFromToken(router, t);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not create workspace');
    } finally {
      setCreating(false);
    }
  }

  return (
    <WizardShell
      title="Business setup"
      subtitle="Review your setup. Create a new workspace now, or apply the draft to an existing tenant you already own."
      steps={steps}
      currentKey="review"
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-smoke-400/10 bg-ivory-50/85 shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-smoke-400/[0.06] bg-ivory-100/60 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-smoke-200">Business</p>
              <p className="mt-2 font-display text-lg font-semibold text-smoke-400">{draft.business?.name ?? '—'}</p>
              <p className="mt-1 text-sm text-smoke-200">{draft.business?.brandName ?? '—'}</p>
            </div>
            <div className="rounded-2xl border border-smoke-400/[0.06] bg-ivory-100/60 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-smoke-200">Category</p>
              <p className="mt-2 font-mono text-sm text-smoke-400">{draft.category ?? '—'}</p>
              <p className="mt-1 text-sm text-smoke-200">{draft.subtype ?? '—'}</p>
            </div>
            <div className="rounded-2xl border border-smoke-400/[0.06] bg-ivory-100/60 p-4 md:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-smoke-200">First branch</p>
              <p className="mt-2 font-display text-lg font-semibold text-smoke-400">{draft.branch?.name ?? '—'}</p>
              <p className="mt-1 font-mono text-xs text-smoke-200">{draft.branch?.code ?? '—'}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-smoke-400/10 bg-ivory-50/85 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tenants.length ? (
              <div className="space-y-3">
                <p className="text-sm text-smoke-200">Use an existing tenant you already manage.</p>
                <Select value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
                  <option value="">Select tenant</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name ?? t.id.slice(0, 8)}
                    </option>
                  ))}
                </Select>
                <Button type="button" size="lg" className="w-full" disabled={!canApply || pending} onClick={() => void apply()}>
                  {pending ? 'Applying…' : 'Apply & enter workspace'}
                </Button>

                <div className="rounded-2xl border border-smoke-400/10 bg-ivory-100/75 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Need another business?</p>
                  <p className="mt-2 text-sm text-smoke-200">Create a new trial workspace and send it to admin review.</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 w-full border-smoke-400/18"
                    disabled={!canCreateWorkspace || creating}
                    onClick={() => void createWorkspace()}
                  >
                    {creating ? 'Creating…' : 'Create new workspace'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <EmptyState
                  icon="fluent-color:building-shop-24"
                  title="Create your first workspace"
                  description="TIPTAP can open a trial tenant, enable your category, assign you as owner, and create your first branch right now."
                  action={
                    <Button
                      type="button"
                      size="lg"
                      className="shadow-card"
                      disabled={!canCreateWorkspace || creating}
                      onClick={() => void createWorkspace()}
                    >
                      {creating ? 'Creating…' : 'Create workspace & continue'}
                    </Button>
                  }
                />
                <div className="rounded-2xl border border-amber-900/10 bg-amber-50/35 p-4 text-sm text-amber-950">
                  Admin can review and approve this tenant later from the approvals desk. You can still enter setup immediately as the owner.
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-smoke-400/10 bg-smoke-400 p-4 text-ivory-100">
              <div className="flex items-start gap-3">
                <Icon icon="ph:info-duotone" className="mt-0.5 h-5 w-5 text-ivory-200" aria-hidden />
                <p className="text-sm leading-relaxed text-ivory-200/95">
                  New workspaces open as <span className="font-semibold text-ivory-100">TRIAL</span> with your category and first branch already attached.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild className="border-smoke-400/18">
                <Link href="/onboarding/business/branch">Back</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </WizardShell>
  );
}
