'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AttentionPanel, type AttentionItem } from '@/components/workspace/attention-panel';
import { ChartCard } from '@/components/ui/chart-card';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { analyticsOverview } from '@/lib/api/analytics';
import { me } from '@/lib/api/auth';
import { adminMetrics, type AdminMetrics } from '@/lib/api/admin-metrics';
import { ApiError } from '@/lib/api/client';
import { paymentsReconciliationFlags } from '@/lib/api/payments-dashboard';
import { reconciliationOverview } from '@/lib/api/reconciliation';
import { getStoredToken } from '@/lib/auth/storage';
import { CHART, chartTooltipStyle } from '@/lib/chart-theme';
import { defaultDateRange, formatMinorUnits } from '@/lib/format';
import { toast } from '@/lib/toast';

type Overview = {
  payments?: {
    pendingCount?: number;
    failedCount?: number;
    byStatus?: { status: string; count: number; amountCents: number }[];
  };
  tips?: {
    byModeAndStatus?: { mode: string; status: string; count: number; amountCents: number }[];
  };
  ratings?: {
    averageScore?: number | null;
    totalCount?: number | null;
    byTargetType?: { targetType: string; count: number }[];
  };
};

const ease = [0.22, 1, 0.36, 1] as const;

const roleCatalog = [
  {
    code: 'SUPER_ADMIN',
    label: 'Super admin',
    icon: 'fluent-color:apps-48',
    body: 'Platform-wide command and governance.',
  },
  {
    code: 'TENANT_OWNER',
    label: 'Tenant owner',
    icon: 'fluent-color:building-store-24',
    body: 'Business setup and payment ownership.',
  },
  {
    code: 'BRANCH_MANAGER',
    label: 'Branch manager',
    icon: 'fluent-color:building-people-24',
    body: 'Branch operations and service flow.',
  },
  {
    code: 'SERVICE_STAFF',
    label: 'Service staff',
    icon: 'fluent-color:people-team-48',
    body: 'Personal workspace for daily work.',
  },
  {
    code: 'CASHIER',
    label: 'Cashier',
    icon: 'fluent-color:coin-multiple-48',
    body: 'Collection-sensitive flows.',
  },
  {
    code: 'SUPPORT_AGENT',
    label: 'Support agent',
    icon: 'fluent-color:person-feedback-48',
    body: 'Support and intervention surfaces.',
  },
] as const;

const commandModules = [
  {
    title: 'Approvals',
    body: 'Move merchants into live operation.',
    href: '/admin/approvals',
    icon: 'fluent-color:alert-24',
    accent: 'from-violet-50 via-ivory-100 to-violet-100/50',
  },
  {
    title: 'Users & roles',
    body: 'Provision and audit platform access.',
    href: '/admin/users',
    icon: 'fluent-color:people-team-48',
    accent: 'from-sky-50 via-ivory-100 to-violet-100/40',
  },
  {
    title: 'Reconciliation',
    body: 'Watch failed, stale, and drift states.',
    href: '/admin/reconciliation',
    icon: 'fluent-color:coin-multiple-48',
    accent: 'from-amber-50 via-ivory-100 to-orange-100/55',
  },
  {
    title: 'System control',
    body: 'Gateway tests and system checks.',
    href: '/admin/system',
    icon: 'fluent-color:apps-list-detail-32',
    accent: 'from-emerald-50 via-ivory-100 to-teal-100/55',
  },
] as const;

function sumCompletedTips(o: Overview | null) {
  const rows = o?.tips?.byModeAndStatus ?? [];
  return rows.filter((r) => r.status === 'COMPLETED').reduce((a, b) => a + (b.amountCents ?? 0), 0);
}

export default function AdminHomePage() {
  const [profile, setProfile] = useState<{ roles?: { role: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [recon, setRecon] = useState<Record<string, unknown> | null>(null);
  const [flags, setFlags] = useState<Record<string, unknown> | null>(null);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const range = defaultDateRange();
  const token = getStoredToken();

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      me(token),
      analyticsOverview(token, { startDate: range.startDate, endDate: range.endDate }),
      reconciliationOverview(token, {}),
      paymentsReconciliationFlags(token, {}),
      adminMetrics(token),
    ])
      .then(([p, ov, ro, fl, am]) => {
        if (cancelled) {
          return;
        }
        setProfile(p.status === 'fulfilled' ? (p.value as { roles?: { role: string }[] }) : null);
        setOverview(ov.status === 'fulfilled' ? ((ov.value ?? null) as Overview) : null);
        setRecon(ro.status === 'fulfilled' ? ((ro.value ?? null) as Record<string, unknown>) : null);
        setFlags(fl.status === 'fulfilled' ? ((fl.value ?? null) as Record<string, unknown>) : null);
        setMetrics(am.status === 'fulfilled' ? ((am.value ?? null) as AdminMetrics) : null);

        const failures = [p, ov, ro, fl, am].filter((result) => result.status === 'rejected');
        if (failures.length > 0) {
          const first = failures[0];
          const message =
            first.status === 'rejected'
              ? first.reason instanceof ApiError
                ? first.reason.message
                : first.reason instanceof Error
                  ? first.reason.message
                  : 'Some admin panels could not load'
              : 'Some admin panels could not load';
          toast.error(message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [range.endDate, range.startDate, token]);

  const isAdmin = Boolean(profile?.roles?.some((r) => r.role === 'SUPER_ADMIN'));

  const reconCounts = recon?.counts as
    | {
        providerLocalStatusMismatch?: number;
        stalePending?: number;
        payoutPendingQueue?: number;
      }
    | undefined;

  const mismatchCount = reconCounts?.providerLocalStatusMismatch ?? 0;
  const stalePendingCount = reconCounts?.stalePending ?? 0;
  const payoutQueueCount = reconCounts?.payoutPendingQueue ?? 0;
  const webhookPossiblyStale = (flags as { flags?: { webhookPossiblyStale?: boolean } } | null)?.flags
    ?.webhookPossiblyStale === true;

  const failed = overview?.payments?.failedCount ?? 0;
  const pending = overview?.payments?.pendingCount ?? 0;
  const roleCounts = metrics?.users?.rolesByCode ?? {};
  const tenantStatusCounts = metrics?.tenants?.byStatus ?? {};
  const trialsPending = Number(tenantStatusCounts.TRIAL ?? 0);
  const categoryCounts = metrics?.categories?.enabledByCode ?? {};
  const topTenants = metrics?.tenants?.topByVolume7d ?? [];
  const ratingsByType = overview?.ratings?.byTargetType ?? [];

  const attentionItems: AttentionItem[] = useMemo(() => {
    const items: AttentionItem[] = [];
    if (trialsPending > 0) {
      items.push({
        id: 'trials',
        severity: 'warning',
        title: `${trialsPending} merchant${trialsPending === 1 ? '' : 's'} awaiting activation`,
        detail: 'Review TRIAL tenants and mark them ACTIVE when ready.',
        href: '/admin/approvals',
      });
    }
    if (mismatchCount > 0) {
      items.push({
        id: 'mismatch',
        severity: 'critical',
        title: `${mismatchCount} reconciliation mismatch${mismatchCount === 1 ? '' : 'es'}`,
        detail: 'Provider status and local ledger drift need direct intervention.',
        href: '/admin/reconciliation',
      });
    }
    if (stalePendingCount > 0) {
      items.push({
        id: 'stale',
        severity: 'warning',
        title: `${stalePendingCount} stale pending transaction${stalePendingCount === 1 ? '' : 's'}`,
        detail: 'Likely webhook delay or refresh-status gap.',
        href: '/admin/payments-health',
      });
    }
    if (webhookPossiblyStale) {
      items.push({
        id: 'webhook',
        severity: 'warning',
        title: 'Webhook delivery may be stale',
        detail: 'Platform heuristic suggests delayed inbound payment confirmation.',
        href: '/admin/payments-health',
      });
    }
    if ((metrics?.landingPages?.published ?? 0) === 0 && (metrics?.tenants?.total ?? 0) > 0) {
      items.push({
        id: 'landing',
        severity: 'info',
        title: 'No published merchant landing pages yet',
        detail: 'Brand and acquisition surfaces are still underused across tenants.',
        href: '/admin/tenants',
      });
    }
    if (failed > 10) {
      items.push({
        id: 'failed',
        severity: 'info',
        title: `${failed} failed payments across platform in this period`,
        detail: 'Review payment health for concentrated provider or tenant issues.',
        href: '/admin/payments-health',
      });
    }
    return items;
  }, [
    failed,
    metrics?.landingPages?.published,
    metrics?.tenants?.total,
    mismatchCount,
    stalePendingCount,
    trialsPending,
    webhookPossiblyStale,
  ]);

  const paymentHistogram = useMemo(
    () => [
      { label: 'Completed 24h', value: metrics?.payments?.completed24h?.count ?? 0 },
      { label: 'Completed 7d', value: metrics?.payments?.completed7d?.count ?? 0 },
      { label: 'Failed 24h', value: metrics?.payments?.failed24h?.count ?? 0 },
      { label: 'Pending', value: pending },
      { label: 'Mismatch', value: mismatchCount },
      { label: 'Payout queue', value: payoutQueueCount },
    ],
    [metrics?.payments?.completed24h?.count, metrics?.payments?.completed7d?.count, metrics?.payments?.failed24h?.count, mismatchCount, pending, payoutQueueCount],
  );

  const trafficHistogram = useMemo(
    () => [
      { label: 'QR scans', value: metrics?.qr?.scanned24h ?? 0 },
      { label: 'Sessions', value: metrics?.conversations?.sessions24h ?? 0 },
      { label: 'Active convos', value: metrics?.conversations?.active24h ?? 0 },
      { label: 'Messages', value: metrics?.conversations?.messages24h ?? 0 },
      { label: 'Audit events', value: metrics?.audits?.events24h ?? 0 },
    ],
    [metrics?.audits?.events24h, metrics?.conversations?.active24h, metrics?.conversations?.messages24h, metrics?.conversations?.sessions24h, metrics?.qr?.scanned24h],
  );

  const roleRows = useMemo(
    () =>
      roleCatalog.map((role) => ({
        ...role,
        count: Number(roleCounts[role.code] ?? 0),
      })),
    [roleCounts],
  );

  const maxRoleCount = Math.max(1, ...roleRows.map((role) => role.count));
  const maxTenantAmount = Math.max(1, ...topTenants.map((tenant) => tenant.amountCents ?? 0));

  const categoryRows = useMemo(
    () => [
      {
        code: 'FOOD_DINING',
        label: 'Food & Dining',
        icon: 'fluent-color:building-store-24',
        count: Number(categoryCounts.FOOD_DINING ?? 0),
      },
      {
        code: 'BEAUTY_GROOMING',
        label: 'Beauty & Grooming',
        icon: 'fluent-color:person-starburst-48',
        count: Number(categoryCounts.BEAUTY_GROOMING ?? 0),
      },
    ],
    [categoryCounts],
  );

  const tenantStatusRows = Object.entries(tenantStatusCounts).map(([status, count]) => ({
    status,
    count: Number(count ?? 0),
  }));
  const maxTenantStatusCount = Math.max(1, ...tenantStatusRows.map((row) => row.count));

  const platformCards = [
    {
      label: 'Revenue 7d',
      value: formatMinorUnits(metrics?.payments?.completed7d?.amountCents ?? 0),
      hint: `${metrics?.payments?.completed7d?.count ?? 0} completed payments`,
      icon: 'fluent-color:coin-multiple-48',
      className: 'border-emerald-200/45 bg-gradient-to-br from-emerald-50/90 via-ivory-50 to-emerald-100/55',
    },
    {
      label: 'Tenants',
      value: metrics?.tenants?.total ?? '—',
      hint: `${metrics?.branches?.total ?? 0} branches`,
      icon: 'fluent-color:building-people-24',
      className: 'border-sky-200/45 bg-gradient-to-br from-sky-50/90 via-ivory-50 to-cyan-100/55',
    },
    {
      label: 'Conversations 24h',
      value: metrics?.conversations?.active24h ?? '—',
      hint: `${metrics?.conversations?.messages24h ?? 0} messages`,
      icon: 'fluent-color:chat-48',
      className: 'border-violet-200/45 bg-gradient-to-br from-violet-50/90 via-ivory-50 to-fuchsia-100/45',
    },
    {
      label: 'Risk signals',
      value: attentionItems.length,
      hint: attentionItems.length ? 'Needs review' : 'All clear',
      icon: 'fluent-color:alert-urgent-24',
      className: 'border-amber-200/45 bg-gradient-to-br from-amber-50/90 via-ivory-50 to-orange-100/55',
    },
  ] as const;

  const commandCards = [
    {
      label: 'Tenants',
      meta: `${metrics?.tenants?.total ?? 0} active records`,
      href: '/admin/tenants',
      icon: 'fluent-color:building-store-24',
    },
    {
      label: 'Roles',
      meta: `${metrics?.users?.total ?? 0} users`,
      href: '/admin/users',
      icon: 'fluent-color:people-team-48',
    },
    {
      label: 'Payments',
      meta: `${metrics?.paymentConfigs?.active ?? 0} live configs`,
      href: '/admin/payments-health',
      icon: 'fluent-color:coin-multiple-48',
    },
    {
      label: 'Risk',
      meta: `${attentionItems.length} open items`,
      href: '/admin/audit-risk',
      icon: 'fluent-color:alert-24',
    },
    {
      label: 'Impersonate',
      meta: 'Support access',
      href: '/admin/impersonation',
      icon: 'fluent-color:contact-card-48',
    },
    {
      label: 'System',
      meta: 'Health and rails',
      href: '/admin/system',
      icon: 'fluent-color:apps-list-detail-32',
    },
  ] as const;

  if (!token) {
    return (
      <EmptyState
        variant="premium"
        icon="ph:lock-key-duotone"
        title="Sign in required"
        description="Sign in with a Super Admin account to open the platform command center."
        action={
          <Link href="/login" className="font-semibold text-smoke-400 underline underline-offset-4">
            Sign in
          </Link>
        }
      />
    );
  }

  if (!isAdmin && !loading) {
    return (
      <EmptyState
        variant="premium"
        icon="ph:shield-warning-duotone"
        title="Admin access required"
        description="Your account does not have the SUPER_ADMIN role required for this workspace."
      />
    );
  }

  return (
    <div className="space-y-6 md:space-y-7">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-900/60">
            Super admin
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-smoke-400 md:text-[2.35rem]">
            Platform overview
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-smoke-200">
            Live command for tenants, payments, conversations, and risk across TIPTAP.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[560px]">
          <div className="rounded-[1.2rem] border border-smoke-400/[0.08] bg-ivory-50/90 px-4 py-3 shadow-soft">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Date range</p>
            <p className="mt-2 text-sm font-semibold text-smoke-400">
              {range.startDate} → {range.endDate}
            </p>
          </div>
          <div className="rounded-[1.2rem] border border-smoke-400/[0.08] bg-ivory-50/90 px-4 py-3 shadow-soft">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Scope</p>
            <p className="mt-2 text-sm font-semibold text-smoke-400">All tenants</p>
          </div>
          <div className="rounded-[1.2rem] border border-smoke-400/[0.08] bg-ivory-50/90 px-4 py-3 shadow-soft">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Attention</p>
            <p className="mt-2 text-sm font-semibold text-smoke-400">
              {attentionItems.length ? `${attentionItems.length} open` : 'Stable'}
            </p>
          </div>
        </div>
      </div>

      {!loading && trialsPending > 0 ? (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }}>
          <Link
            href="/admin/approvals"
            className="group flex flex-col gap-4 rounded-[1.35rem] border border-violet-300/40 bg-gradient-to-br from-violet-50/95 via-ivory-50 to-amber-50/50 p-5 shadow-[0_12px_40px_-24px_rgba(91,33,182,0.35)] transition hover:border-violet-400/55 hover:shadow-[0_16px_48px_-20px_rgba(91,33,182,0.4)] md:flex-row md:items-center md:justify-between"
          >
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md ring-4 ring-violet-200/40">
                <Icon icon="ph:hourglass-high-duotone" className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-900/65">Activation queue</p>
                <p className="mt-1 font-display text-lg font-semibold text-smoke-400">
                  {trialsPending} business{trialsPending === 1 ? '' : 'es'} waiting for verification
                </p>
                <p className="mt-1 max-w-2xl text-sm text-smoke-200">
                  TRIAL merchants need a super admin to activate them. Open approvals to review tenants and set status to
                  ACTIVE.
                </p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition group-hover:bg-violet-800">
              Open approvals
              <Icon icon="ph:arrow-right-bold" className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        </motion.div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-12">
          <Skeleton className="h-52 rounded-[1.4rem] md:col-span-7" />
          <Skeleton className="h-52 rounded-[1.4rem] md:col-span-5" />
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl md:col-span-3" />
          ))}
          <Skeleton className="h-80 rounded-[1.6rem] md:col-span-6" />
          <Skeleton className="h-80 rounded-[1.6rem] md:col-span-6" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.82fr)]">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-smoke-400/10 shadow-card">
                <CardContent className="space-y-5 p-6 md:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-900/60">
                        Summary deck
                      </p>
                      <p className="mt-2 font-display text-xl font-semibold text-smoke-400">
                        Live posture across money, tenants, conversations, and risk
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-violet-200/30 bg-violet-50/55 px-3 py-1.5 text-xs font-semibold text-violet-900">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-violet-500/80" aria-hidden />
                      Super admin live
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {platformCards.map((card) => (
                      <div
                        key={card.label}
                        className={`rounded-[1.35rem] border p-4 shadow-soft ${card.className}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-smoke-200">
                              {card.label}
                            </p>
                            <p className="mt-2 font-display text-xl font-semibold text-smoke-400">{card.value}</p>
                          </div>
                          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/85 shadow-soft">
                            <Icon icon={card.icon} className="h-6 w-6" aria-hidden />
                          </span>
                        </div>
                        <p className="mt-3 text-xs text-smoke-200">{card.hint}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {commandCards.map((card) => (
                      <Link
                        key={card.label}
                        href={card.href}
                        className="group rounded-[1.25rem] border border-smoke-400/[0.08] bg-ivory-50/92 p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-smoke-400/14 hover:shadow-card"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/90 shadow-soft">
                            <Icon icon={card.icon} className="h-6 w-6" aria-hidden />
                          </span>
                          <Icon
                            icon="ph:arrow-up-right"
                            className="h-4 w-4 text-smoke-200 transition group-hover:text-smoke-400"
                            aria-hidden
                          />
                        </div>
                        <p className="mt-4 font-display text-base font-semibold text-smoke-400">{card.label}</p>
                        <p className="mt-1 text-xs text-smoke-200">{card.meta}</p>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, ease }} className="space-y-4">
              <AttentionPanel
                title="Risk feed"
                subtitle="Items that need a direct admin touch"
                items={attentionItems}
                emptyHint="No major alarms surfaced in the current checks."
              />

              <Card className="border-smoke-400/10 shadow-card">
                <CardContent className="grid gap-4 p-6">
                  <div className="rounded-[1.25rem] border border-smoke-400/[0.08] bg-ivory-50/92 p-4 shadow-soft">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Revenue 24h</p>
                    <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">
                      {formatMinorUnits(metrics?.payments?.completed24h?.amountCents ?? 0)}
                    </p>
                    <p className="mt-2 text-xs text-smoke-200">
                      {metrics?.payments?.completed24h?.count ?? 0} completed payments
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.25rem] border border-smoke-400/[0.08] bg-ivory-50/92 p-4 shadow-soft">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Tips 7d</p>
                      <p className="mt-2 font-display text-lg font-semibold text-smoke-400">
                        {formatMinorUnits(metrics?.tips?.completed7d?.amountCents ?? sumCompletedTips(overview))}
                      </p>
                    </div>
                    <div className="rounded-[1.25rem] border border-violet-200/28 bg-violet-50/45 p-4 shadow-soft">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-900/70">
                        Guest sentiment
                      </p>
                      <p className="mt-2 font-display text-lg font-semibold text-smoke-400">
                        {overview?.ratings?.averageScore != null ? overview.ratings.averageScore.toFixed(2) : '—'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon="fluent-color:building-store-24" label="Tenants" value={metrics?.tenants?.total ?? '—'} hint="Across platform" />
            <StatCard icon="fluent-color:building-people-24" label="Branches" value={metrics?.branches?.total ?? '—'} hint="Operational footprint" />
            <StatCard icon="fluent-color:people-team-48" label="Users" value={metrics?.users?.total ?? '—'} hint="All accounts" />
            <StatCard icon="fluent-color:contact-card-48" label="Staff records" value={metrics?.staff?.total ?? '—'} hint="Merchant-linked profiles" />
            <StatCard icon="fluent-color:person-starburst-48" label="Provider registry" value={metrics?.staff?.providerProfiles ?? '—'} hint="Portable identities" />
            <StatCard icon="fluent-color:apps-list-detail-32" label="Active QR" value={metrics?.qr?.active ?? '—'} hint={`${metrics?.qr?.total ?? 0} total issued`} />
            <StatCard icon="fluent-color:chat-48" label="Active convos (24h)" value={metrics?.conversations?.active24h ?? '—'} hint={`${metrics?.conversations?.messages24h ?? 0} messages`} />
            <StatCard icon="fluent-color:globe-shield-48" label="Published landing pages" value={metrics?.landingPages?.published ?? '—'} hint={`${metrics?.paymentConfigs?.active ?? 0} active payment configs`} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ease }}>
              <ChartCard
                title="Payment pipeline histogram"
                description="Counts across completed, failed, pending, and drift states."
                action={
                  <Link href="/admin/payments-health" className="text-sm font-semibold text-smoke-400 underline-offset-4 hover:underline">
                    Open payment health
                  </Link>
                }
                className="border-smoke-400/10 shadow-card"
                contentClassName="h-80 px-6 pb-6"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paymentHistogram}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={52} />
                    <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [value, 'Count']} contentStyle={chartTooltipStyle} />
                    <Bar dataKey="value" fill={CHART.primary} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, ease }}>
              <ChartCard
                title="Traffic and governance activity"
                description="QR, conversations, and audit movement in the last 24 hours."
                action={
                  <Link href="/admin/audit-risk" className="text-sm font-semibold text-smoke-400 underline-offset-4 hover:underline">
                    Open audit & risk
                  </Link>
                }
                className="border-smoke-400/10 shadow-card"
                contentClassName="h-80 px-6 pb-6"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trafficHistogram}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={52} />
                    <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [value, 'Count']} contentStyle={chartTooltipStyle} />
                    <Bar dataKey="value" fill={CHART.primaryMuted} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </motion.div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
            <Card className="border-smoke-400/10 shadow-card">
              <CardContent className="space-y-5 p-6 md:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Role governance</p>
                    <p className="mt-2 font-display text-xl font-semibold text-smoke-400">
                      Access stays safe when roles stay clean
                    </p>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-smoke-200">Keep platform power separate from tenant and branch access.</p>
                  </div>
                  <Link
                    href="/admin/users"
                    className="rounded-xl border border-smoke-400/10 bg-ivory-50/90 px-3 py-2 text-sm font-semibold text-smoke-400 shadow-soft transition hover:border-smoke-400/18"
                  >
                    Manage roles
                  </Link>
                </div>

                <div className="grid gap-4">
                  {roleRows.map((role) => (
                    <div key={role.code} className="rounded-[1.35rem] border border-smoke-400/[0.08] bg-ivory-50/90 p-4 shadow-soft">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-smoke-400/[0.06] text-smoke-400 ring-1 ring-smoke-400/[0.05]">
                          <Icon icon={role.icon} className="h-5 w-5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="font-display text-lg font-semibold text-smoke-400">{role.label}</p>
                            <span className="font-display text-lg font-semibold text-smoke-400">{role.count}</span>
                          </div>
                          <p className="mt-1 text-sm leading-relaxed text-smoke-200">{role.body}</p>
                          <div className="mt-3 h-2.5 rounded-full bg-smoke-400/[0.07]">
                            <div
                              className="h-full rounded-full bg-smoke-400"
                              style={{ width: `${Math.max(10, (role.count / maxRoleCount) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-smoke-400/10 shadow-card">
              <CardContent className="space-y-5 p-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Tenant momentum</p>
                  <p className="mt-2 font-display text-xl font-semibold text-smoke-400">Top revenue tenants</p>
                  <p className="mt-2 text-sm leading-relaxed text-smoke-200">See who is carrying platform volume this week.</p>
                </div>

                {topTenants.length ? (
                  <div className="space-y-3">
                    {topTenants.map((tenant) => (
                      <Link
                        key={tenant.tenantId}
                        href={`/admin/tenants/${encodeURIComponent(tenant.tenantId ?? '')}`}
                        className="block rounded-[1.3rem] border border-smoke-400/[0.08] bg-ivory-50/92 p-4 shadow-soft transition hover:border-smoke-400/14 hover:shadow-card"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate font-display text-lg font-semibold text-smoke-400">
                              {tenant.name ?? tenant.tenantId}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-smoke-200">
                              {tenant.status ?? 'Unknown status'}
                            </p>
                          </div>
                          <p className="shrink-0 font-display text-base font-semibold text-smoke-400">
                            {formatMinorUnits(tenant.amountCents ?? 0)}
                          </p>
                        </div>
                        <div className="mt-3 h-2.5 rounded-full bg-smoke-400/[0.07]">
                          <div
                            className="h-full rounded-full bg-violet-700/75"
                            style={{ width: `${Math.max(12, ((tenant.amountCents ?? 0) / maxTenantAmount) * 100)}%` }}
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-smoke-200">
                          <span>{tenant.paymentCount ?? 0} payments</span>
                          <span>{tenant.branchCount ?? 0} branches</span>
                          <span>{tenant.staffCount ?? 0} staff records</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[1.3rem] border border-smoke-400/[0.08] bg-ivory-50/92 p-4 text-sm text-smoke-200">
                    Completed volume will populate here as tenant payments grow.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="border-smoke-400/10 shadow-card">
              <CardContent className="space-y-6 p-6 md:p-7">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Usage coverage</p>
                  <p className="mt-2 font-display text-xl font-semibold text-smoke-400">How the platform is being used</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[1.3rem] border border-smoke-400/[0.08] bg-ivory-50/92 p-4 shadow-soft">
                    <p className="text-sm font-semibold text-smoke-400">Tenant status spread</p>
                    <div className="mt-4 space-y-3">
                      {tenantStatusRows.length ? (
                        tenantStatusRows.map((row) => (
                          <div key={row.status}>
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="font-medium text-smoke-300">{row.status.replaceAll('_', ' ')}</span>
                              <span className="font-semibold text-smoke-400">{row.count}</span>
                            </div>
                            <div className="mt-2 h-2.5 rounded-full bg-smoke-400/[0.07]">
                              <div
                                className="h-full rounded-full bg-smoke-400"
                                style={{ width: `${Math.max(12, (row.count / maxTenantStatusCount) * 100)}%` }}
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-smoke-200">Tenant status data will appear here.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[1.3rem] border border-smoke-400/[0.08] bg-ivory-50/92 p-4 shadow-soft">
                    <p className="text-sm font-semibold text-smoke-400">Category adoption</p>
                    <div className="mt-4 space-y-3">
                      {categoryRows.map((row) => (
                        <div key={row.code}>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="inline-flex items-center gap-2 font-medium text-smoke-300">
                              <Icon icon={row.icon} className="h-4 w-4 text-smoke-400" aria-hidden />
                              {row.label}
                            </span>
                            <span className="font-semibold text-smoke-400">{row.count}</span>
                          </div>
                          <div className="mt-2 h-2.5 rounded-full bg-smoke-400/[0.07]">
                            <div
                              className="h-full rounded-full bg-violet-700/75"
                              style={{ width: `${Math.max(12, (row.count / Math.max(1, metrics?.tenants?.total ?? 1)) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.3rem] border border-violet-200/30 bg-violet-50/40 p-4">
                  <p className="text-sm font-semibold text-smoke-400">Feedback coverage</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ratingsByType.length ? (
                      ratingsByType.map((rating) => (
                        <span
                          key={rating.targetType}
                          className="inline-flex items-center gap-2 rounded-full border border-smoke-400/[0.08] bg-ivory-100 px-3 py-1 text-xs font-medium text-smoke-300"
                        >
                          {rating.targetType}
                          <span className="font-semibold text-smoke-400">{rating.count}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-smoke-200">Structured ratings will surface here as merchants collect more feedback.</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-smoke-400/10 shadow-card">
              <CardContent className="space-y-5 p-6 md:p-7">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Core super admin powers</p>
                  <p className="mt-2 font-display text-xl font-semibold text-smoke-400">Control the surfaces that keep TIPTAP stable</p>
                  <p className="mt-2 text-sm leading-relaxed text-smoke-200">Fast access to activation, access, finance, and system health.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {commandModules.map((module, index) => (
                    <motion.div
                      key={module.title}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04, ease }}
                    >
                      <Link
                        href={module.href}
                        className="group block rounded-[1.4rem] border border-smoke-400/[0.08] bg-ivory-50/92 p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-smoke-400/14 hover:shadow-card"
                      >
                        <div className={`rounded-[1.2rem] border border-white/60 bg-gradient-to-br ${module.accent} p-4`}>
                          <div className="flex items-start justify-between gap-3">
                            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 text-smoke-400 ring-1 ring-smoke-400/[0.05]">
                              <Icon icon={module.icon} className="h-6 w-6" aria-hidden />
                            </span>
                            <Icon
                              icon="ph:arrow-up-right-duotone"
                              className="h-5 w-5 text-smoke-200 transition group-hover:text-smoke-400"
                              aria-hidden
                            />
                          </div>
                          <p className="mt-4 font-display text-lg font-semibold text-smoke-400">{module.title}</p>
                          <p className="mt-2 text-sm leading-relaxed text-smoke-200">{module.body}</p>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
