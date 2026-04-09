'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { QuickActionStrip } from '@/components/workspace/quick-action-strip';
import { WorkspaceHero } from '@/components/workspace/workspace-hero';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { me, type MeResponse } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { getProviderWorkspace, type ProviderWorkspace } from '@/lib/api/provider-workspace';
import { getStoredToken } from '@/lib/auth/storage';
import { compactText } from '@/lib/copy';
import { formatMinorUnits } from '@/lib/format';
import { toast } from '@/lib/toast';

function roleSummary(roles: MeResponse['roles']) {
  const labels: Record<string, string> = {
    SERVICE_STAFF: 'Service staff',
    CASHIER: 'Cashier',
    BRANCH_MANAGER: 'Branch manager',
    TENANT_OWNER: 'Owner',
    SUPPORT_AGENT: 'Support',
    SUPER_ADMIN: 'Admin',
  };
  return roles.map((role) => labels[role.role] ?? role.role.replaceAll('_', ' '));
}

export default function ProviderHomePage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [workspace, setWorkspace] = useState<ProviderWorkspace | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      me(token).then((payload) => setProfile(payload as MeResponse)),
      getProviderWorkspace(token).then((payload) => setWorkspace(payload)).catch(() => setWorkspace(null)),
    ])
      .catch((error) => toast.error(error instanceof ApiError ? error.message : 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const roles = profile?.roles ?? [];
  const roleLabels = useMemo(() => roleSummary(roles), [roles]);
  const personalIdentity = workspace?.providerProfile?.registryCode ?? workspace?.providerProfile?.publicSlug ?? 'Pending link';
  const skillCount = Array.isArray(workspace?.providerProfile?.skills) ? workspace.providerProfile.skills.length : 0;
  const linkedBusinesses = workspace?.summary.linkedBusinesses ?? 0;
  const activeAssignments = workspace?.summary.activeAssignments ?? 0;
  const totalCompensation = workspace?.summary.totalCompensationCents ?? 0;
  const totalTips = workspace?.summary.totalTipsCents ?? 0;
  const ratingAverage = workspace?.summary.ratingAverage ?? null;

  const assignmentSummary = useMemo(() => {
    if (!workspace?.links?.length) {
      return ['No business link yet'];
    }
    return workspace.links.map((link) => {
      const lane = link.categories[0]?.replaceAll('_', ' ').toLowerCase() ?? 'service';
      return `${link.tenantName ?? 'Business'}${link.branchName ? ` · ${link.branchName}` : ''} · ${lane}`;
    });
  }, [workspace?.links]);

  if (!getStoredToken()) {
    return (
      <EmptyState
        variant="premium"
        icon="ph:lock-key-duotone"
        title="Sign in required"
        description="Sign in to open your personal workspace — requests, tips, and feedback stay separate from the manager control room."
        action={
          <Link href="/login" className="font-semibold text-smoke-400 underline underline-offset-4">
            Sign in
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <WorkspaceHero
        tone="personal"
        eyebrow="My workday"
        title={profile?.name ? `${profile.name.split(' ')[0]}, your workspace is ready` : 'Your day at a glance'}
        description="A smarter personal dashboard for service teams: clearer identity, cleaner role context, and a calmer starting point for daily work."
        meta={[
          ...(profile?.email ? [{ icon: 'fluent-color:contact-card-48', label: profile.email }] : []),
          { icon: 'fluent-color:person-starburst-48', label: `Identity: ${personalIdentity}` },
        ]}
      >
        <QuickActionStrip
          accent="personal"
          className="w-full min-w-[240px] max-w-sm lg:w-80"
          title="My shortcuts"
          actions={[
            { href: '/provider/requests', label: 'Requests', icon: 'fluent-color:chat-48', hint: 'Task queue' },
            { href: '/provider/earnings', label: 'Earnings', icon: 'fluent-color:wallet-credit-card-16', hint: 'Salary' },
            { href: '/provider/tips', label: 'Tips', icon: 'fluent-color:coin-multiple-48', hint: 'My tips' },
            { href: '/provider/ratings', label: 'Ratings', icon: 'fluent-color:person-feedback-48', hint: 'Feedback' },
            { href: '/provider/profile', label: 'Profile', icon: 'fluent-color:contact-card-48', hint: 'My identity' },
          ]}
        />
      </WorkspaceHero>

      {!loading && workspace && !workspace.links?.length ? (
        <Card className="border-amber-200/70 bg-gradient-to-br from-amber-50/85 via-ivory-50/90 to-ivory-100/80 shadow-soft">
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:gap-8">
            <div className="min-w-0 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-900/65">
                Not linked to a business yet
              </p>
              <p className="max-w-2xl text-sm text-smoke-200">
                Give your registry code to a manager so they can link you to their team. Tips, orders, and compensation
                appear here after you are connected.
              </p>
              {workspace.providerProfile?.registryCode ? (
                <p className="font-mono text-lg font-semibold tracking-[0.12em] text-smoke-400">
                  {workspace.providerProfile.registryCode}
                </p>
              ) : (
                <p className="text-sm text-smoke-200">Open your profile to see or refresh your registry code.</p>
              )}
            </div>
            <Button asChild className="shrink-0 shadow-soft">
              <Link href="/provider/profile">Open profile</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              icon="fluent-color:person-starburst-48"
              label="Identity"
              value={personalIdentity}
              hint="Code or slug"
            />
            <StatCard
              icon="fluent-color:building-people-24"
              label="Business links"
              value={linkedBusinesses}
              hint={activeAssignments ? `${activeAssignments} active assignments` : 'No active assignments'}
            />
            <StatCard
              icon="fluent-color:wallet-credit-card-16"
              label="Earnings"
              value={formatMinorUnits(totalCompensation)}
              hint={workspace?.summary.compensationCount ? `${workspace.summary.compensationCount} pay rows` : 'No pay rows yet'}
            />
            <StatCard
              icon="fluent-color:coin-multiple-48"
              label="Tips"
              value={formatMinorUnits(totalTips)}
              hint="Across linked work"
            />
            <StatCard
              icon="fluent-color:person-feedback-48"
              label="Ratings"
              value={ratingAverage != null ? ratingAverage.toFixed(2) : '—'}
              hint={workspace?.summary.ratingCount ? `${workspace.summary.ratingCount} feedback rows` : 'No feedback yet'}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card className="border-teal-900/10 bg-gradient-to-br from-teal-50/45 via-ivory-100/72 to-ivory-100/92 shadow-card">
                <CardContent className="space-y-5 p-6 md:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-900/55">
                        Personal dashboard
                      </p>
                      <p className="mt-2 font-display text-xl font-semibold text-smoke-400">
                        Built for your day, not merchant settings
                      </p>
                      <p className="mt-2 max-w-xl text-[13px] text-smoke-200">
                        Personal tools only. Your linked businesses, tips, and feedback stay here.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-teal-800/15 bg-ivory-100/90 px-3 py-1.5 text-xs font-semibold text-teal-900">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-teal-500" aria-hidden />
                      Personal view
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Link
                      href="/provider/profile"
                      className="group flex gap-3 rounded-[1.3rem] border border-smoke-400/[0.08] bg-ivory-100/80 p-4 transition hover:border-teal-800/20 hover:shadow-soft"
                    >
                      <Icon icon="fluent-color:contact-card-48" className="mt-0.5 h-6 w-6" aria-hidden />
                      <div>
                        <p className="text-sm font-semibold text-smoke-400 group-hover:underline">Profile</p>
                        <p className="text-xs text-smoke-200">Identity and skills.</p>
                      </div>
                    </Link>
                    <Link
                      href="/provider/assignments"
                      className="group flex gap-3 rounded-[1.3rem] border border-smoke-400/[0.08] bg-ivory-100/80 p-4 transition hover:border-teal-800/20 hover:shadow-soft"
                    >
                      <Icon icon="fluent-color:building-people-24" className="mt-0.5 h-6 w-6" aria-hidden />
                      <div>
                        <p className="text-sm font-semibold text-smoke-400 group-hover:underline">Assignments</p>
                        <p className="text-xs text-smoke-200">Current links.</p>
                      </div>
                    </Link>
                    <Link
                      href="/provider/earnings"
                      className="group flex gap-3 rounded-[1.3rem] border border-smoke-400/[0.08] bg-ivory-100/80 p-4 transition hover:border-teal-800/20 hover:shadow-soft"
                    >
                      <Icon icon="fluent-color:wallet-credit-card-16" className="mt-0.5 h-6 w-6" aria-hidden />
                      <div>
                        <p className="text-sm font-semibold text-smoke-400 group-hover:underline">Earnings</p>
                        <p className="text-xs text-smoke-200">Salary and pay.</p>
                      </div>
                    </Link>
                    <Link
                      href="/provider/tips"
                      className="group flex gap-3 rounded-[1.3rem] border border-smoke-400/[0.08] bg-ivory-100/80 p-4 transition hover:border-teal-800/20 hover:shadow-soft"
                    >
                      <Icon icon="fluent-color:coin-multiple-48" className="mt-0.5 h-6 w-6" aria-hidden />
                      <div>
                        <p className="text-sm font-semibold text-smoke-400 group-hover:underline">Tips</p>
                        <p className="text-xs text-smoke-200">Tips and earnings.</p>
                      </div>
                    </Link>
                    <Link
                      href="/provider/ratings"
                      className="group flex gap-3 rounded-[1.3rem] border border-smoke-400/[0.08] bg-ivory-100/80 p-4 transition hover:border-teal-800/20 hover:shadow-soft"
                    >
                      <Icon icon="fluent-color:person-feedback-48" className="mt-0.5 h-6 w-6" aria-hidden />
                      <div>
                        <p className="text-sm font-semibold text-smoke-400 group-hover:underline">Ratings</p>
                        <p className="text-xs text-smoke-200">Guest feedback.</p>
                      </div>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-smoke-400/10 shadow-soft">
                <CardContent className="p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Current role map</p>
                  <div className="mt-4 grid gap-3">
                    {assignmentSummary.map((entry, index) => (
                      <div
                        key={`${entry}-${index}`}
                        className="rounded-[1.2rem] border border-smoke-400/[0.07] bg-ivory-50/90 px-4 py-3 text-sm font-medium text-smoke-400"
                      >
                        {entry}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <Card className="border-smoke-400/10 shadow-soft">
              <CardContent className="space-y-5 p-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">About you in TIPTAP</p>
                  <p className="mt-3 font-display text-lg font-semibold text-smoke-400">
                    {workspace?.providerProfile?.displayName ?? profile?.name ?? 'Your profile'}
                  </p>
                  <p className="mt-2 text-[13px] text-smoke-200">
                    {compactText(
                      workspace?.providerProfile?.headline ??
                        'Complete your profile so managers can recognize your identity.',
                      88,
                    )}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="rounded-[1.2rem] border border-smoke-400/[0.07] bg-ivory-50/90 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Verified summary</p>
                    <p className="mt-2 text-[13px] text-smoke-300">
                      {compactText(
                        workspace?.providerProfile?.verifiedSummary ?? 'Trusted summary will show here when available.',
                        88,
                      )}
                    </p>
                  </div>

                  <div className="rounded-[1.2rem] border border-smoke-400/[0.07] bg-ivory-50/90 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Roles</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {roleLabels.length ? (
                        roleLabels.map((label, index) => (
                          <span
                            key={`${label}-${index}`}
                            className="inline-flex items-center rounded-full border border-smoke-400/[0.08] bg-ivory-100 px-3 py-1 text-xs font-medium text-smoke-300"
                          >
                            {label}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-smoke-200">No active role labels yet.</span>
                      )}
                    </div>
                  </div>

                  {workspace?.links?.length ? (
                    <div className="rounded-[1.2rem] border border-smoke-400/[0.07] bg-ivory-50/90 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Linked businesses</p>
                      <p className="mt-2 text-[13px] text-smoke-300">
                        {workspace.links
                          .map((link) => `${link.tenantName ?? 'Business'}${link.branchName ? ` · ${link.branchName}` : ''}`)
                          .join(' • ')}
                      </p>
                    </div>
                  ) : null}

                  <div className="rounded-[1.2rem] border border-smoke-400/[0.07] bg-ivory-50/90 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Skills</p>
                    <p className="mt-2 text-[13px] text-smoke-300">
                      {skillCount > 0 ? `${skillCount} skill tags on your identity.` : 'Add skill tags to improve matching.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild className="flex-1 shadow-soft">
                      <Link href="/provider/profile">Open profile</Link>
                    </Button>
                    <Button asChild variant="outline" className="flex-1">
                      <Link href="/dashboard">Manager view</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
