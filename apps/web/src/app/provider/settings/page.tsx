'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { KeyValueList } from '@/components/ui/key-value-list';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { ApiError } from '@/lib/api/client';
import { getProviderWorkspace, type ProviderWorkspace } from '@/lib/api/provider-workspace';
import { getStoredToken } from '@/lib/auth/storage';
import { formatMinorUnits } from '@/lib/format';
import { toast } from '@/lib/toast';

export default function ProviderSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<ProviderWorkspace | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getProviderWorkspace(token)
      .then((payload) => setWorkspace(payload))
      .catch((error) => {
        toast.error(error instanceof ApiError ? error.message : 'Could not load settings');
        setWorkspace(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const categoryLabels = useMemo(
    () =>
      [...new Set(workspace?.summary.categories ?? [])]
        .map((category) => category.replaceAll('_', ' ').toLowerCase())
        .join(', '),
    [workspace?.summary.categories],
  );

  if (!getStoredToken()) {
    return (
      <EmptyState
        variant="premium"
        icon="ph:lock-key-duotone"
        title="Sign in required"
        description="Sign in to open your personal settings."
        action={
          <Button asChild className="shadow-soft">
            <Link href="/login">Sign in</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Preferences" title="Work settings" description="Identity, routing, payouts, and lane coverage." />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon="fluent-color:person-starburst-48"
            label="Registry"
            value={workspace?.providerProfile?.registryCode ?? '—'}
            hint={workspace?.providerProfile?.publicSlug ?? 'No public slug yet'}
          />
          <StatCard
            icon="fluent-color:building-people-24"
            label="Linked businesses"
            value={workspace?.summary.linkedBusinesses ?? 0}
            hint={`${workspace?.summary.activeAssignments ?? 0} active assignments`}
          />
          <StatCard
            icon="fluent-color:wallet-credit-card-16"
            label="Paid"
            value={formatMinorUnits(workspace?.summary.paidCompensationCents ?? 0)}
            hint={`Scheduled ${formatMinorUnits(workspace?.summary.scheduledCompensationCents ?? 0)}`}
          />
          <StatCard
            icon="fluent-color:chat-help-24"
            label="Live routing"
            value={(workspace?.desk?.openRequestCount ?? 0) + (workspace?.desk?.activeTaskCount ?? 0)}
            hint={categoryLabels || 'No active lanes'}
          />
        </div>
      )}

      {!loading && !workspace ? (
        <EmptyState icon="fluent-color:alert-24" title="Settings unavailable" description="Reload the page to try again." />
      ) : null}

      {!loading && workspace ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-6">
            <Card className="border-smoke-400/10 shadow-card">
              <CardHeader className="border-b border-smoke-400/[0.06]">
                <CardTitle className="text-base">Identity</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <KeyValueList
                  rows={[
                    { label: 'Display', value: workspace.providerProfile?.displayName ?? '—' },
                    { label: 'Registry code', value: workspace.providerProfile?.registryCode ?? '—' },
                    { label: 'Public slug', value: workspace.providerProfile?.publicSlug ?? '—' },
                    {
                      label: 'Skills',
                      value: Array.isArray(workspace.providerProfile?.skills) && workspace.providerProfile.skills.length
                        ? workspace.providerProfile.skills.join(', ')
                        : 'Not added yet',
                    },
                  ]}
                />
                <div className="mt-4">
                  <Button asChild variant="outline" className="rounded-full">
                    <Link href="/provider/profile">Edit profile</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-smoke-400/10 shadow-card">
              <CardHeader className="border-b border-smoke-400/[0.06]">
                <CardTitle className="text-base">Routing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                {workspace.links.length ? (
                  workspace.links.map((link) => (
                    <div key={link.staffId} className="rounded-2xl border border-smoke-400/[0.08] bg-ivory-100/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-smoke-400">{link.tenantName ?? 'Business'}</p>
                          <p className="mt-1 text-xs text-smoke-200">{link.branchName ?? 'Branch not set'}</p>
                        </div>
                        <div className="text-right text-xs text-smoke-200">
                          <div>{link.activeAssignments.length} active</div>
                          <div>{link.assignmentHistory.length} past</div>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-smoke-200">
                        {link.categories.map((category) => category.replaceAll('_', ' ').toLowerCase()).join(', ') || 'No lane'}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon="fluent-color:building-people-24"
                    title="No routing yet"
                    description="A manager link will activate your live desk."
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-smoke-400/10 shadow-card">
              <CardHeader className="border-b border-smoke-400/[0.06]">
                <CardTitle className="text-base">Payouts & pulse</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <KeyValueList
                  rows={[
                    { label: 'Total pay', value: formatMinorUnits(workspace.summary.totalCompensationCents) },
                    { label: 'Paid', value: formatMinorUnits(workspace.summary.paidCompensationCents) },
                    { label: 'Scheduled', value: formatMinorUnits(workspace.summary.scheduledCompensationCents) },
                    {
                      label: 'Payout method',
                      value: workspace.providerProfile?.payoutProfile?.method?.replaceAll('_', ' ') ?? 'Not set',
                    },
                    {
                      label: 'Destination',
                      value: workspace.providerProfile?.payoutProfile?.accountMask ?? 'Add in profile',
                      hint: workspace.providerProfile?.payoutProfile?.recipientLabel ?? undefined,
                    },
                    { label: 'Tips', value: formatMinorUnits(workspace.summary.totalTipsCents) },
                    {
                      label: 'Ratings',
                      value: workspace.summary.ratingAverage != null ? workspace.summary.ratingAverage.toFixed(2) : '—',
                      hint: workspace.summary.ratingCount ? `${workspace.summary.ratingCount} rows` : undefined,
                    },
                  ]}
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild variant="outline" className="rounded-full">
                    <Link href="/provider/earnings">Open earnings</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full">
                    <Link href="/provider/tips">Open tips</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-smoke-400/10 shadow-card">
              <CardHeader className="border-b border-smoke-400/[0.06]">
                <CardTitle className="text-base">Alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                <div className="rounded-2xl border border-smoke-400/[0.08] bg-ivory-100/70 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Requests</p>
                  <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">{workspace.desk.openRequestCount}</p>
                </div>
                <div className="rounded-2xl border border-smoke-400/[0.08] bg-ivory-100/70 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Service lane</p>
                  <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">{workspace.desk.activeTaskCount}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild className="rounded-full shadow-soft">
                    <Link href="/provider/requests">Open request desk</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full">
                    <Link href="/provider/assignments">Assignments</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
