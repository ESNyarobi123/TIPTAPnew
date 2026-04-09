'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricMini } from '@/components/ui/metric-mini';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { analyticsRatings, analyticsTips } from '@/lib/api/analytics';
import { ApiError } from '@/lib/api/client';
import { getStoredToken } from '@/lib/auth/storage';
import { compactText } from '@/lib/copy';
import { defaultDateRange, formatMinorUnits } from '@/lib/format';
import { listTenantCategories } from '@/lib/api/tenants-branches';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type HubCard = {
  href: string;
  title: string;
  description: string;
  icon: string;
  eyebrow: string;
  points: string[];
};

function ManagerHubCard({ card }: { card: HubCard }) {
  return (
    <Card className="group h-full border-smoke-400/10 bg-ivory-50/90 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-card">
      <CardHeader className="border-b border-smoke-400/[0.06] pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">{card.eyebrow}</p>
            <CardTitle className="mt-2 text-lg">{card.title}</CardTitle>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-smoke-400/[0.06] text-smoke-400">
            <Icon icon={card.icon} className="h-5 w-5" aria-hidden />
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex h-full flex-col pt-5">
        <p className="text-[13px] text-smoke-200">{compactText(card.description, 78)}</p>
        <div className="mt-4 space-y-2 text-sm text-smoke-300">
          {card.points.slice(0, 2).map((point) => (
            <div key={point} className="flex items-start gap-2">
              <Icon icon="ph:check-circle-duotone" className="mt-0.5 h-4 w-4 shrink-0 text-smoke-400" aria-hidden />
              <span>{point}</span>
            </div>
          ))}
        </div>
        <Button asChild variant="outline" className="mt-5 w-full justify-between">
          <Link href={card.href}>
            Open workspace
            <Icon icon="ph:arrow-up-right-duotone" className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function OperationsIndexPage() {
  const { tenantId, branchId, loading: scopeLoading, tenants, branches } = useScope();
  const range = defaultDateRange();
  const [ratings, setRatings] = useState<unknown>(null);
  const [tips, setTips] = useState<unknown>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const tenantName = useMemo(
    () => tenants.find((item) => item.id === tenantId)?.name ?? null,
    [tenantId, tenants],
  );
  const branchName = useMemo(
    () => branches.find((item) => item.id === branchId)?.name ?? null,
    [branchId, branches],
  );

  useEffect(() => {
    const token = getStoredToken();
    if (!token || scopeLoading || !tenantId) {
      setLoading(false);
      setRatings(null);
      setTips(null);
      setCategories([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const q = {
      tenantId,
      branchId: branchId ?? undefined,
      startDate: range.startDate,
      endDate: range.endDate,
    };

    Promise.all([
      analyticsTips(token, q),
      analyticsRatings(token, q),
      listTenantCategories(token, tenantId),
    ])
      .then(([tipsPayload, ratingsPayload, categoryPayload]) => {
        if (cancelled) {
          return;
        }
        setTips(tipsPayload);
        setRatings(ratingsPayload);
        const enabled = (Array.isArray(categoryPayload) ? categoryPayload : [])
          .filter(
            (item): item is { category: string; enabled: true } =>
              isRecord(item) && item.enabled === true && typeof item.category === 'string',
          )
          .map((item) => String(item.category));
        setCategories(enabled);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof ApiError ? error.message : 'Could not load manager hub');
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
  }, [tenantId, branchId, scopeLoading, range.endDate, range.startDate]);

  const tipsRecord = isRecord(tips) ? tips : null;
  const tipTotals = isRecord(tipsRecord?.totals) ? tipsRecord.totals : null;
  const ratingsRecord = isRecord(ratings) ? ratings : null;
  const overallRatings = isRecord(ratingsRecord?.overall) ? ratingsRecord.overall : null;
  const lowAlerts = isRecord(ratingsRecord?.lowRatingAlerts) ? ratingsRecord.lowRatingAlerts : null;

  const hasFood = categories.includes('FOOD_DINING');
  const hasBeauty = categories.includes('BEAUTY_GROOMING');

  const guestChannels: HubCard[] = [
    {
      href: '/dashboard/qr',
      title: 'QR launch control',
      description: 'Generate business, table, station, or staff QR entry points with secure TIPTAP handoff.',
      icon: 'ph:qr-code-duotone',
      eyebrow: 'Guest entry',
      points: ['Business and staff QR flows', 'Printable deployment card', 'Direct WhatsApp handoff'],
    },
    {
      href: '/dashboard/conversations',
      title: 'WhatsApp inbox',
      description: 'Read live guest sessions, transcripts, context, and service requests from one manager view.',
      icon: 'ph:chat-circle-text-duotone',
      eyebrow: 'Conversation flow',
      points: ['Transcript timeline', 'Guest context per scan', 'Floor-team visibility'],
    },
    {
      href: '/dashboard/settings/landing',
      title: 'Landing page',
      description: 'Publish a clean public page with business details, services, and a branded CTA URL.',
      icon: 'ph:globe-hemisphere-west-duotone',
      eyebrow: 'Brand surface',
      points: ['Simple page builder', 'Theme presets and preview', 'System-generated public URL'],
    },
  ];

  const teamAndService: HubCard[] = [
    {
      href: '/dashboard/staff',
      title: 'Staff and providers',
      description: 'Create, update, remove, assign, and generate QR flows for your service team.',
      icon: 'ph:users-three-duotone',
      eyebrow: 'Team control',
      points: ['Portable provider linking', 'Profile and assignment management', 'Staff QR shortcuts'],
    },
    {
      href: '/dashboard/food-dining',
      title: 'Food & Dining',
      description: 'Manage menu, tables, waiter operations, and restaurant guest flow from one module.',
      icon: 'ph:fork-knife-duotone',
      eyebrow: 'Category module',
      points: ['Menu and table setup', 'Bill and waiter requests', 'Dining-service visibility'],
    },
    {
      href: '/dashboard/beauty-grooming',
      title: 'Beauty & Grooming',
      description: 'Run services, stations, provider workflows, and salon support operations with category logic.',
      icon: 'ph:sparkle-duotone',
      eyebrow: 'Category module',
      points: ['Services and pricing', 'Station-aware QR flows', 'Provider assistance queue'],
    },
  ].filter((card) => {
    if (card.href.endsWith('/food-dining')) {
      return hasFood || (!hasFood && !hasBeauty);
    }
    if (card.href.endsWith('/beauty-grooming')) {
      return hasBeauty || (!hasFood && !hasBeauty);
    }
    return true;
  });

  const financeAndTrust: HubCard[] = [
    {
      href: '/dashboard/payments',
      title: 'Payments workspace',
      description: 'Track live volume, pending rows, provider health, and reconciliation signals without leaving the dashboard.',
      icon: 'ph:credit-card-duotone',
      eyebrow: 'Money flow',
      points: ['Collections and payouts', 'Recent transactions', 'Provider and webhook health'],
    },
    {
      href: '/dashboard/settings/payments',
      title: 'Payment configuration',
      description: 'Manage merchant payment credentials safely with masked previews and validation checks.',
      icon: 'ph:shield-check-duotone',
      eyebrow: 'Finance setup',
      points: ['Encrypted provider keys', 'Connection test action', 'Merchant-specific payment rails'],
    },
    {
      href: '/dashboard/analytics',
      title: 'Tips and guest feedback',
      description: 'See guest sentiment, tip movement, and low-score alerts coming from the WhatsApp journey.',
      icon: 'ph:star-half-duotone',
      eyebrow: 'Guest trust',
      points: ['Tips by mode and status', 'Ratings pulse and low-score alerts', 'Drill into service trends'],
    },
    {
      href: '/dashboard/reconciliation',
      title: 'Reconciliation and audit',
      description: 'Review payment exceptions, follow activity history, and keep the business side accountable.',
      icon: 'ph:scales-duotone',
      eyebrow: 'Control',
      points: ['Exception review', 'Immutable audit trail', 'Manager-safe oversight'],
    },
  ];

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        eyebrow="Operations"
        title="Manager hub"
        description={
          tenantName
            ? `${tenantName}${branchName ? ` · ${branchName}` : ''} in one runbook. Move from guest entry to staff, service modules, payments, and public presence without a messy dashboard.`
            : 'Run TIPTAP like a proper control room: guest entry, staff, payments, trust signals, and public presence in one place.'
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/qr">Launch QR</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/staff">Manage staff</Link>
            </Button>
          </div>
        }
      />

      {!tenantId && !scopeLoading ? (
        <EmptyState
          variant="premium"
          icon="ph:buildings-duotone"
          title="Select a tenant"
          description="Choose a tenant in the header to unlock staff, payments, landing pages, and service modules for that business."
        />
      ) : null}

      {tenantId ? (
        <Card className="overflow-hidden border-smoke-400/10 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.08),transparent_45%),linear-gradient(135deg,rgba(255,253,248,0.95),rgba(244,239,229,0.92))] shadow-card">
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)] lg:p-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Manager flow</p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-smoke-400">
                Guest scan to revenue to feedback
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-smoke-200">
                TIPTAP should feel like one modern operating system. A guest scans, lands in WhatsApp, requests service,
                pays, tips, and leaves feedback. This hub keeps those surfaces close to the manager instead of scattering
                them across disconnected pages.
              </p>
            </div>
            <div className="grid gap-3">
              <div className="rounded-2xl border border-smoke-400/10 bg-ivory-100/75 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Current scope</p>
                <p className="mt-2 text-base font-semibold text-smoke-400">{tenantName ?? 'Tenant required'}</p>
                <p className="mt-1 text-sm text-smoke-200">{branchName ?? 'All branches in scope'}</p>
              </div>
              <div className="rounded-2xl border border-smoke-400/10 bg-ivory-100/75 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Tracking window</p>
                <p className="mt-2 text-base font-semibold text-smoke-400">
                  {range.startDate} to {range.endDate}
                </p>
                <p className="mt-1 text-sm text-smoke-200">Tips, ratings, and service movement for the current manager scope.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {loading && tenantId ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : null}

      {!loading && tenantId ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricMini
            icon="ph:device-mobile-duotone"
            label="Digital tips"
            value={formatMinorUnits(typeof tipTotals?.digitalTipsCents === 'number' ? tipTotals.digitalTipsCents : 0)}
            hint="Completed in selected scope"
          />
          <MetricMini
            icon="ph:hand-coins-duotone"
            label="Cash tips"
            value={formatMinorUnits(typeof tipTotals?.cashTipsCents === 'number' ? tipTotals.cashTipsCents : 0)}
            hint="Recorded by staff"
          />
          <MetricMini
            icon="ph:star-duotone"
            label="Average rating"
            value={
              typeof overallRatings?.averageScore === 'number'
                ? overallRatings.averageScore.toFixed(2)
                : '—'
            }
            hint={
              typeof overallRatings?.count === 'number'
                ? `${overallRatings.count} feedback item${overallRatings.count === 1 ? '' : 's'}`
                : 'Ratings appear after guest reviews'
            }
          />
          <MetricMini
            icon="ph:warning-diamond-duotone"
            label="Low-score alerts"
            value={typeof lowAlerts?.count === 'number' ? lowAlerts.count : 0}
            hint="Need service recovery attention"
          />
        </div>
      ) : null}

      <section className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Guest channels</p>
          <h3 className="mt-2 font-display text-xl font-semibold text-smoke-400">Bring customers in the right way</h3>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {guestChannels.map((card) => (
            <ManagerHubCard key={card.href} card={card} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Team and service delivery</p>
          <h3 className="mt-2 font-display text-xl font-semibold text-smoke-400">Control people, roles, and category workflows</h3>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {teamAndService.map((card) => (
            <ManagerHubCard key={card.href} card={card} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Money and trust</p>
          <h3 className="mt-2 font-display text-xl font-semibold text-smoke-400">Stay close to payments, tips, and accountability</h3>
        </div>
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
          {financeAndTrust.map((card) => (
            <ManagerHubCard key={card.href} card={card} />
          ))}
        </div>
      </section>
    </div>
  );
}
