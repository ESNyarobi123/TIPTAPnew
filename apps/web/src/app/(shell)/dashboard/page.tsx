'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { AttentionPanel, type AttentionItem } from '@/components/workspace/attention-panel';
import { ActivityRail, type ActivityRailItem } from '@/components/workspace/activity-rail';
import { ModuleChecklist, type ChecklistRow } from '@/components/workspace/module-checklist';
import { QuickActionStrip } from '@/components/workspace/quick-action-strip';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { hasCategory } from '@/lib/business-categories';
import { analyticsOperations, analyticsOverview } from '@/lib/api/analytics';
import { ApiError } from '@/lib/api/client';
import { defaultDateRange, formatMinorUnits } from '@/lib/format';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

type OverviewShape = {
  period?: { start?: string; end?: string };
  payments?: {
    pendingCount?: number;
    failedCount?: number;
    byStatus?: { status: string; count: number; amountCents: number }[];
  };
  tips?: {
    byModeAndStatus?: { mode: string; status: string; count: number; amountCents: number }[];
  };
  ratings?: { averageScore?: number | null; totalCount?: number | null };
};

type OpsShape = {
  waiterCalls?: { byStatus?: { status: string; count: number }[]; total?: number };
  billRequests?: { byStatus?: { status: string; count: number }[]; total?: number };
  assistanceRequests?: { byStatus?: { status: string; count: number }[]; total?: number };
  diningCustomerService?: { byStatus?: { status: string; count: number }[]; total?: number };
};

const OPEN_DINING = new Set(['PENDING', 'ACKNOWLEDGED', 'OPEN', 'IN_PROGRESS']);

const EXPERIENCE_EASE = [0.22, 1, 0.36, 1] as const;

function sumByStatuses(rows: { status: string; count: number }[] | undefined, open: Set<string>) {
  if (!rows) {
    return 0;
  }
  return rows.filter((r) => open.has(r.status)).reduce((a, b) => a + b.count, 0);
}

function completedTipCents(tips: OverviewShape['tips']) {
  const rows = tips?.byModeAndStatus ?? [];
  return rows.filter((r) => r.status === 'COMPLETED').reduce((a, b) => a + (b.amountCents ?? 0), 0);
}

export default function DashboardHomePage() {
  const { tenantId, branchId, loading: scopeLoading, tenants, branches, tenantCategories } = useScope();
  const [data, setData] = useState<OverviewShape | null>(null);
  const [ops, setOps] = useState<OpsShape | null>(null);
  const [loading, setLoading] = useState(true);
  const range = defaultDateRange();

  const tenantLabel = useMemo(() => tenants.find((t) => t.id === tenantId)?.name, [tenants, tenantId]);
  const branchLabel = useMemo(() => branches.find((b) => b.id === branchId)?.name, [branches, branchId]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token || scopeLoading) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    const q = {
      tenantId: tenantId ?? undefined,
      branchId: branchId ?? undefined,
      startDate: range.startDate,
      endDate: range.endDate,
    };
    Promise.all([
      analyticsOverview(token, q).then((raw) => (cancelled ? null : (raw as OverviewShape))),
      analyticsOperations(token, q).then((raw) => (cancelled ? null : (raw as OpsShape))),
    ])
      .then(([ov, op]) => {
        if (!cancelled) {
          setData(ov);
          setOps(op);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(e instanceof ApiError ? e.message : 'Failed to load overview');
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
  }, [tenantId, branchId, scopeLoading, range.startDate, range.endDate]);

  const completed = data?.payments?.byStatus?.find((s) => s.status === 'COMPLETED');
  const volume = completed?.amountCents ?? 0;
  const tipTotal = completedTipCents(data?.tips);
  const openFood =
    sumByStatuses(ops?.waiterCalls?.byStatus, new Set(['PENDING', 'ACKNOWLEDGED'])) +
    sumByStatuses(ops?.billRequests?.byStatus, new Set(['PENDING', 'ACKNOWLEDGED'])) +
    sumByStatuses(ops?.diningCustomerService?.byStatus, OPEN_DINING);
  const openBeauty = sumByStatuses(ops?.assistanceRequests?.byStatus, new Set(['PENDING', 'ACKNOWLEDGED']));
  const openTotal = openFood + openBeauty;
  const pendingPayments = data?.payments?.pendingCount ?? 0;
  const failedPayments = data?.payments?.failedCount ?? 0;
  const completedCount = completed?.count ?? 0;
  const paymentAttempts =
    data?.payments?.byStatus?.reduce((sum, row) => sum + (row.count ?? 0), 0) ?? 0;
  const paymentSuccessRate =
    paymentAttempts > 0 ? Math.round((completedCount / paymentAttempts) * 100) : null;
  const ratingAverage = data?.ratings?.averageScore ?? null;
  const ratingCount = data?.ratings?.totalCount ?? 0;

  const hasFood = hasCategory(tenantCategories, 'FOOD_DINING');
  const hasBeauty = hasCategory(tenantCategories, 'BEAUTY_GROOMING');
  const openRequestsValue =
    hasFood && hasBeauty ? openTotal : hasFood ? openFood : hasBeauty ? openBeauty : 0;
  const openRequestsDetail =
    openRequestsValue > 0
      ? hasFood && hasBeauty
        ? 'Dining and beauty queues are active'
        : hasFood
          ? 'Dining guest signals are active'
          : 'Beauty assistance is active'
      : hasFood || hasBeauty
        ? 'No active guest queues right now'
        : 'Enable Food or Beauty under Setup → Categories to track module queues';
  const checklistAccent = hasFood && !hasBeauty ? 'food' : hasBeauty && !hasFood ? 'beauty' : 'business';
  const scopeSummary = branchLabel
    ? `${tenantLabel ?? 'Current business'} · ${branchLabel}`
    : tenantLabel ?? 'Choose a business scope';
  const categoryState = hasFood && hasBeauty
    ? 'Food & Beauty live'
    : hasFood
      ? 'Food & Dining live'
      : hasBeauty
        ? 'Beauty & Grooming live'
        : 'Category setup pending';
  const managerBriefing =
    openTotal > 0
      ? `${openTotal} guest request${openTotal === 1 ? '' : 's'} still need attention.`
      : failedPayments > 0
        ? `${failedPayments} payment${failedPayments === 1 ? '' : 's'} failed and should be checked.`
        : pendingPayments > 0
          ? `${pendingPayments} payment${pendingPayments === 1 ? '' : 's'} are still pending confirmation.`
          : 'Queues are calm and collections look steady.';

  const checklistRows: ChecklistRow[] = useMemo(() => {
    const rows: ChecklistRow[] = [
      {
        key: 'qr',
        label: 'QR launch points',
        hint: 'Guest entry',
        href: '/dashboard/qr',
        icon: 'fluent-color:apps-list-detail-32',
      },
      {
        key: 'staff',
        label: 'Team setup',
        href: '/dashboard/staff',
        icon: 'fluent-color:people-team-48',
      },
      {
        key: 'pay',
        label: 'Payment config',
        href: '/dashboard/settings/payments',
        icon: 'fluent-color:coin-multiple-48',
      },
    ];
    if (!hasFood && !hasBeauty) {
      rows.push({
        key: 'cat',
        label: 'Choose your business type',
        hint: 'Food, beauty, or both',
        href: '/dashboard/settings/categories',
        icon: 'fluent-color:apps-48',
      });
    } else {
      if (hasFood) {
        rows.push({
          key: 'fd',
          label: 'Dining setup',
          hint: 'Menu & floor',
          href: '/dashboard/food-dining',
          icon: 'fluent-color:building-store-24',
        });
      }
      if (hasBeauty) {
        rows.push({
          key: 'bg',
          label: 'Beauty setup',
          hint: 'Services & stations',
          href: '/dashboard/beauty-grooming',
          icon: 'fluent-color:person-starburst-48',
        });
      }
    }
    return rows;
  }, [hasFood, hasBeauty]);

  const attentionItems: AttentionItem[] = useMemo(() => {
    const items: AttentionItem[] = [];
    const failed = data?.payments?.failedCount ?? 0;
    const pending = data?.payments?.pendingCount ?? 0;
    if (failed > 0) {
      items.push({
        id: 'failed',
        severity: 'critical',
        title: `${failed} failed payment${failed === 1 ? '' : 's'} in period`,
        detail: 'Check provider response.',
        href: '/dashboard/payments',
      });
    }
    if (pending > 5) {
      items.push({
        id: 'pending',
        severity: 'warning',
        title: `${pending} payments still pending`,
        detail: 'Review stale pending items.',
        href: '/dashboard/reconciliation',
      });
    }
    if (openTotal > 0) {
      items.push({
        id: 'queue',
        severity: 'info',
        title: `${openTotal} open guest request${openTotal === 1 ? '' : 's'}${branchLabel ? ` · ${branchLabel}` : ''}`,
        detail: 'Queues are active.',
        href: '/dashboard/operations',
      });
    }
    return items;
  }, [data?.payments?.failedCount, data?.payments?.pendingCount, openTotal, branchLabel]);

  const activityItems: ActivityRailItem[] = useMemo(() => {
    const items: ActivityRailItem[] = [];
    const showDiningOps = hasFood;
    const showBeautyOps = hasBeauty;
    const wc = sumByStatuses(ops?.waiterCalls?.byStatus, new Set(['PENDING', 'ACKNOWLEDGED']));
    if (showDiningOps && wc > 0) {
      items.push({
        id: 'wc',
        title: `${wc} active waiter call${wc === 1 ? '' : 's'}`,
        detail: 'Dining',
        href: '/dashboard/food-dining/ops',
        icon: 'fluent-color:alert-24',
      });
    }
    const br = sumByStatuses(ops?.billRequests?.byStatus, new Set(['PENDING', 'ACKNOWLEDGED']));
    if (showDiningOps && br > 0) {
      items.push({
        id: 'bill',
        title: `${br} bill request${br === 1 ? '' : 's'} open`,
        href: '/dashboard/food-dining/ops',
        icon: 'fluent-color:contact-card-48',
      });
    }
    const ar = sumByStatuses(ops?.assistanceRequests?.byStatus, new Set(['PENDING', 'ACKNOWLEDGED']));
    if (showBeautyOps && ar > 0) {
      items.push({
        id: 'asst',
        title: `${ar} beauty assistance signal${ar === 1 ? '' : 's'}`,
        href: '/dashboard/beauty-grooming/ops',
        icon: 'fluent-color:people-chat-48',
      });
    }
    if (
      data?.ratings?.averageScore != null &&
      data.ratings.averageScore < 4 &&
      (data.ratings.totalCount ?? 0) > 0
    ) {
      items.push({
        id: 'rate',
        title: `Guest sentiment at ${data.ratings.averageScore.toFixed(1)}`,
        detail: 'Review analytics.',
        href: '/dashboard/analytics',
        icon: 'fluent-color:person-feedback-48',
      });
    }
    return items;
  }, [hasBeauty, hasFood, ops, data?.ratings?.averageScore, data?.ratings?.totalCount]);

  const experienceCards = useMemo(
    () => [
      {
        title: 'WhatsApp inbox',
        body: 'Live guest threads and feedback.',
        href: '/dashboard/conversations',
        cta: 'Open inbox',
        icon: 'fluent-color:chat-48',
        accent: 'from-emerald-50 via-ivory-100 to-emerald-100/60',
      },
      {
        title: 'Staff & providers',
        body: 'Profiles, linking, and staff QR.',
        href: '/dashboard/staff',
        cta: 'Open staff',
        icon: 'fluent-color:people-team-48',
        accent: 'from-teal-50 via-ivory-100 to-teal-100/55',
      },
      {
        title: 'Landing page',
        body: 'Public page, preview, and URL.',
        href: '/dashboard/settings/landing',
        cta: 'Open builder',
        icon: 'fluent-color:globe-shield-48',
        accent: 'from-amber-50 via-ivory-100 to-orange-100/55',
      },
      {
        title: hasFood ? 'Dining workspace' : hasBeauty ? 'Beauty workspace' : 'Category workspace',
        body: hasFood
          ? 'Menus, tables, and floor flow.'
          : hasBeauty
            ? 'Services, stations, and assistance.'
            : 'Choose the main module for this business.',
        href: hasFood ? '/dashboard/food-dining' : hasBeauty ? '/dashboard/beauty-grooming' : '/dashboard/settings/categories',
        cta: hasFood ? 'Open dining' : hasBeauty ? 'Open beauty' : 'Choose module',
        icon: hasFood
          ? 'fluent-color:building-store-24'
          : hasBeauty
            ? 'fluent-color:person-starburst-48'
            : 'fluent-color:apps-48',
        accent: hasFood
          ? 'from-rose-50 via-ivory-100 to-amber-100/55'
          : hasBeauty
            ? 'from-fuchsia-50 via-ivory-100 to-teal-100/40'
            : 'from-smoke-400/[0.03] via-ivory-100 to-ivory-50',
      },
    ],
    [hasBeauty, hasFood],
  );

  const overviewTiles = useMemo(
    () => [
      {
        label: 'Captured volume',
        value: formatMinorUnits(volume),
        detail:
          paymentSuccessRate != null
            ? `${paymentSuccessRate}% payment success in scope`
            : `${completedCount} completed payment${completedCount === 1 ? '' : 's'}`,
        icon: 'fluent-color:coin-multiple-48',
        accent: 'from-emerald-50 via-ivory-50 to-emerald-100/70',
      },
      {
        label: 'Digital tips',
        value: formatMinorUnits(tipTotal),
        detail: 'Tips recorded in range',
        icon: 'fluent-color:gift-card-24',
        accent: 'from-amber-50 via-ivory-50 to-orange-100/65',
      },
      {
        label: 'Open requests',
        value: openRequestsValue.toString(),
        detail: openRequestsDetail,
        icon: 'fluent-color:people-chat-48',
        accent: 'from-sky-50 via-ivory-50 to-cyan-100/65',
      },
      {
        label: 'Guest sentiment',
        value: ratingAverage != null ? ratingAverage.toFixed(2) : '—',
        detail: ratingCount > 0 ? `${ratingCount} review${ratingCount === 1 ? '' : 's'} in scope` : 'Reviews will appear after guest feedback lands',
        icon: 'fluent-color:person-feedback-48',
        accent: 'from-rose-50 via-ivory-50 to-fuchsia-100/65',
      },
    ],
    [
      completedCount,
      openRequestsDetail,
      openRequestsValue,
      paymentSuccessRate,
      ratingAverage,
      ratingCount,
      tipTotal,
      volume,
    ],
  );

  const commandActions = useMemo(
    () => [
      {
        href: '/dashboard/payments',
        label: 'Payments',
        meta: pendingPayments > 0 ? `${pendingPayments} pending` : 'Healthy',
        icon: 'fluent-color:coin-multiple-48',
      },
      {
        href: '/dashboard/conversations',
        label: 'Inbox',
        meta: `${openRequestsValue} active`,
        icon: 'fluent-color:chat-48',
      },
      {
        href: '/dashboard/staff',
        label: 'Team',
        meta: 'Profiles',
        icon: 'fluent-color:people-team-48',
      },
      {
        href: '/dashboard/analytics',
        label: 'Analytics',
        meta: ratingAverage != null ? `${ratingAverage.toFixed(1)} score` : 'Overview',
        icon: 'fluent-color:data-trending-48',
      },
    ],
    [openRequestsValue, pendingPayments, ratingAverage],
  );

  return (
    <div className="space-y-8 md:space-y-10">
      {!tenantId && !scopeLoading ? (
        <EmptyState
          variant="premium"
          icon="ph:buildings-duotone"
          title="Select a tenant"
          description="Choose a tenant in the header to load your control room. If the list is empty, your account may need a role assignment from an administrator."
        />
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-12">
          <Skeleton className="h-36 rounded-[1.25rem] md:col-span-7" />
          <Skeleton className="h-36 rounded-[1.25rem] md:col-span-5" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl md:col-span-3" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_320px]">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="min-w-0"
            >
              <Card className="overflow-hidden border-smoke-400/10 bg-gradient-to-br from-ivory-50/96 via-ivory-100/88 to-amber-50/45 shadow-card">
                <CardContent className="p-5 md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-smoke-200">
                        Default dashboard
                      </p>
                      <p className="mt-2 font-display text-[1.35rem] font-semibold tracking-tight text-smoke-400 md:text-[1.55rem]">
                        {scopeSummary}
                      </p>
                      <p className="mt-2 text-sm text-smoke-200">{managerBriefing}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-smoke-400/[0.08] bg-ivory-50/92 px-3 py-1.5 text-xs font-semibold text-smoke-300">
                        <Icon icon="fluent-color:calendar-data-bar-24" className="h-4 w-4" aria-hidden />
                        {range.startDate} → {range.endDate}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-smoke-400/[0.08] bg-ivory-50/92 px-3 py-1.5 text-xs font-semibold text-smoke-300">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600/80" aria-hidden />
                        {categoryState}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {overviewTiles.map((tile) => (
                      <div
                        key={tile.label}
                        className={`rounded-[1.35rem] border border-smoke-400/[0.06] bg-gradient-to-br ${tile.accent} p-4 shadow-soft`}
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/85 text-smoke-400 shadow-soft ring-1 ring-smoke-400/[0.05]">
                          <Icon icon={tile.icon} className="h-6 w-6" aria-hidden />
                        </span>
                        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-smoke-200">
                          {tile.label}
                        </p>
                        <p className="mt-1.5 font-display text-[1.9rem] font-semibold tracking-tight text-smoke-400">
                          {tile.value}
                        </p>
                        <p className="mt-1.5 line-clamp-2 text-xs text-smoke-200">{tile.detail}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="min-w-0"
            >
              <div className="grid gap-4">
                <Card className="overflow-hidden border-smoke-400/10 bg-gradient-to-br from-smoke-400/[0.03] via-ivory-50/95 to-ivory-100/85 shadow-soft">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-smoke-200">
                          Quick actions
                        </p>
                        <p className="mt-1 text-sm font-medium text-smoke-300">Jump fast</p>
                      </div>
                      <Icon icon="fluent-color:apps-48" className="h-8 w-8" aria-hidden />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2.5">
                      {commandActions.map((action) => (
                        <Link
                          key={action.href}
                          href={action.href}
                          className="group rounded-[1.2rem] border border-smoke-400/[0.07] bg-ivory-50/92 p-3 transition hover:-translate-y-0.5 hover:border-smoke-400/12 hover:shadow-soft"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <Icon icon={action.icon} className="h-8 w-8 shrink-0" aria-hidden />
                            <Icon
                              icon="ph:arrow-up-right-duotone"
                              className="h-4 w-4 text-smoke-200 transition group-hover:text-smoke-400"
                              aria-hidden
                            />
                          </div>
                          <p className="mt-3 text-sm font-semibold text-smoke-400">{action.label}</p>
                          <p className="mt-1 text-xs text-smoke-200">{action.meta}</p>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <AttentionPanel
                  title="Attention"
                  items={attentionItems}
                  emptyHint="No alerts in scope."
                />
              </div>
            </motion.div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="min-w-0"
            >
              <ActivityRail
                title="Live queue"
                items={activityItems}
                emptyLabel="Waiting for guest activity."
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              <Card className="h-full overflow-hidden border-smoke-400/10 bg-gradient-to-br from-smoke-400/[0.03] via-ivory-50/95 to-ivory-100/85 shadow-soft">
                <CardContent className="flex h-full flex-col p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-smoke-200">
                    Service pulse
                  </p>
                  <p className="mt-2 font-display text-lg font-semibold text-smoke-400">
                    {ratingAverage != null && ratingAverage >= 4
                      ? 'Guest experience is trending well.'
                      : ratingAverage != null
                        ? 'Feedback needs a closer look.'
                        : 'Waiting for guest feedback.'}
                  </p>
                  <div className="mt-4 grid gap-3">
                    <div className="rounded-[1.2rem] border border-smoke-400/[0.08] bg-ivory-50/92 p-4">
                      <p className="text-xs font-medium text-smoke-200">Active workspace</p>
                      <p className="mt-1 text-sm font-semibold text-smoke-400">{scopeSummary}</p>
                    </div>
                    <div className="rounded-[1.2rem] border border-smoke-400/[0.08] bg-ivory-50/92 p-4">
                      <p className="text-xs font-medium text-smoke-200">Rating pulse</p>
                      <p className="mt-1 text-sm font-semibold text-smoke-400">
                        {ratingAverage != null ? `${ratingAverage.toFixed(2)} average from ${ratingCount} reviews` : 'No rating data in this window'}
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-smoke-400/[0.08] bg-ivory-50/92 p-4">
                      <p className="text-xs font-medium text-smoke-200">Collections</p>
                      <p className="mt-1 text-sm font-semibold text-smoke-400">
                        {paymentSuccessRate != null ? `${paymentSuccessRate}% completion rate` : 'Waiting for activity'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href="/dashboard/analytics"
                      className="inline-flex items-center gap-2 rounded-full border border-smoke-400/[0.08] bg-ivory-50 px-3 py-2 text-xs font-semibold text-smoke-300 transition hover:border-smoke-400/12 hover:text-smoke-400"
                    >
                      <Icon icon="fluent-color:data-trending-48" className="h-4 w-4" aria-hidden />
                      Analytics
                    </Link>
                    <Link
                      href="/dashboard/operations"
                      className="inline-flex items-center gap-2 rounded-full border border-smoke-400/[0.08] bg-ivory-50 px-3 py-2 text-xs font-semibold text-smoke-300 transition hover:border-smoke-400/12 hover:text-smoke-400"
                    >
                      <Icon icon="fluent-color:apps-list-detail-32" className="h-4 w-4" aria-hidden />
                      Operations
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, ease: EXPERIENCE_EASE }}
            >
              <Card className="overflow-hidden border-smoke-400/10 shadow-card">
                <CardContent className="space-y-5 p-6 md:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">
                        Workspaces
                      </p>
                      <p className="mt-2 font-display text-xl font-semibold text-smoke-400">Run the business from four clear lanes</p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-smoke-400/[0.08] bg-ivory-50/92 px-3 py-1.5 text-xs font-semibold text-smoke-300">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600/80" aria-hidden />
                      Manager ready
                    </span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {experienceCards.map((card, index) => (
                      <motion.div
                        key={card.title}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.38, delay: index * 0.05, ease: EXPERIENCE_EASE }}
                      >
                        <Link
                          href={card.href}
                          className="group block rounded-[1.45rem] border border-smoke-400/[0.08] bg-ivory-50/92 p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-smoke-400/12 hover:shadow-card"
                        >
                          <div className={`rounded-[1.2rem] border border-white/60 bg-gradient-to-br ${card.accent} p-4`}>
                            <div className="flex items-start justify-between gap-3">
                              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 text-smoke-400 ring-1 ring-smoke-400/[0.05]">
                                <Icon icon={card.icon} className="h-6 w-6" aria-hidden />
                              </span>
                              <Icon
                                icon="ph:arrow-up-right-duotone"
                                className="h-5 w-5 text-smoke-200 transition group-hover:text-smoke-400"
                                aria-hidden
                              />
                            </div>
                            <p className="mt-4 font-display text-lg font-semibold text-smoke-400">{card.title}</p>
                            <p className="mt-1.5 text-sm text-smoke-200">{card.body}</p>
                          </div>
                          <p className="mt-3 text-sm font-semibold text-smoke-400">{card.cta}</p>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <QuickActionStrip
              title="Shortcuts"
              actions={[
                {
                  href: '/dashboard/qr',
                  label: 'QR launch',
                  icon: 'fluent-color:apps-list-detail-32',
                  hint: 'Guest entry',
                },
                {
                  href: '/dashboard/settings/payments',
                  label: 'Payment setup',
                  icon: 'fluent-color:coin-multiple-48',
                  hint: 'Credentials',
                },
                {
                  href: '/dashboard/tips',
                  label: 'Tips',
                  icon: 'fluent-color:gift-card-24',
                  hint: 'Earnings',
                },
                {
                  href: '/dashboard/analytics',
                  label: 'Feedback',
                  icon: 'fluent-color:person-feedback-48',
                  hint: 'Ratings',
                },
              ]}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ModuleChecklist
              accent={checklistAccent}
              title="Setup"
              subtitle={
                hasFood || hasBeauty
                  ? 'Modules for this business.'
                  : 'Enable a module to unlock more.'
              }
              rows={checklistRows}
            />
            <QuickActionStrip
              title="Back office"
              actions={[
                {
                  href: '/dashboard/statements',
                  label: 'Statements',
                  icon: 'fluent-color:book-database-32',
                  hint: 'Reports',
                },
                {
                  href: '/dashboard/audit-logs',
                  label: 'Audit trail',
                  icon: 'fluent-color:contact-card-48',
                  hint: 'History',
                },
                {
                  href: '/dashboard/settings/categories',
                  label: 'Modules',
                  icon: 'fluent-color:apps-48',
                  hint: 'Enablement',
                },
                {
                  href: '/dashboard/settings/business',
                  label: 'Business profile',
                  icon: 'fluent-color:building-store-24',
                  hint: 'Brand',
                },
              ]}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
