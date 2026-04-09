'use client';

import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { analyticsFoodDining, analyticsBeautyGrooming } from '@/lib/api/analytics';
import { ApiError } from '@/lib/api/client';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';
import { defaultDateRange } from '@/lib/format';

type FoodSnap = {
  enabled?: boolean;
  tenantIds?: string[];
  period?: { start?: string; end?: string };
  summary?: {
    diningTables?: number;
    menuItems?: number;
    conversationSessions?: number;
    waiterCallsInPeriod?: number;
    billRequestsInPeriod?: number;
    diningSupportInPeriod?: number;
  };
};

type BeautySnap = {
  enabled?: boolean;
  tenantIds?: string[];
  period?: { start?: string; end?: string };
  summary?: {
    beautyStations?: number;
    beautyServices?: number;
    assistanceRequestsInPeriod?: number;
    conversationSessionsInPeriod?: number;
  };
};

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-smoke-400/[0.06] bg-ivory-100/80 px-4 py-3 shadow-soft">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-smoke-400/[0.06] text-smoke-400">
        <Icon icon={icon} className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-smoke-200">{label}</p>
        <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-smoke-400">{value}</p>
      </div>
    </div>
  );
}

export default function AdminCategoryAdoptionPage() {
  const [loading, setLoading] = useState(true);
  const [food, setFood] = useState<FoodSnap | null>(null);
  const [beauty, setBeauty] = useState<BeautySnap | null>(null);
  const range = defaultDateRange();

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      analyticsFoodDining(token, { startDate: range.startDate, endDate: range.endDate }),
      analyticsBeautyGrooming(token, { startDate: range.startDate, endDate: range.endDate }),
    ])
      .then(([f, b]) => {
        setFood((f ?? null) as FoodSnap);
        setBeauty((b ?? null) as BeautySnap);
      })
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load category analytics'))
      .finally(() => setLoading(false));
  }, [range.startDate, range.endDate]);

  if (!getStoredToken()) {
    return (
      <EmptyState
        variant="premium"
        icon="ph:lock-key-duotone"
        title="Sign in required"
        description="Sign in with platform access to review category adoption."
      />
    );
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="platform"
        eyebrow="Platform intelligence"
        title="Category adoption"
        description="Food & Dining vs Beauty & Grooming footprint: configured catalog depth and guest-session volume in the selected window. Use this to see where operators invest versus where categories stay dormant."
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-72 rounded-[1.25rem]" />
          <Skeleton className="h-72 rounded-[1.25rem]" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="h-full overflow-hidden border-smoke-400/10 shadow-card">
              <CardHeader className="border-b border-orange-900/10 bg-gradient-to-r from-orange-50/50 to-transparent">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon icon="ph:fork-knife-duotone" className="h-5 w-5 text-orange-900/70" aria-hidden />
                  Food & Dining
                </CardTitle>
                <p className="text-sm font-normal text-smoke-200">
                  {food?.enabled
                    ? `${food.tenantIds?.length ?? 0} tenant(s) with dining signals in scope`
                    : 'No enabled Food & Dining tenants matched this platform view.'}
                </p>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {food?.enabled ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Metric
                        label="Dining tables"
                        value={food.summary?.diningTables ?? 0}
                        icon="ph:chair-duotone"
                      />
                      <Metric label="Menu items" value={food.summary?.menuItems ?? 0} icon="ph:list-duotone" />
                      <Metric
                        label="Guest sessions"
                        value={food.summary?.conversationSessions ?? 0}
                        icon="ph:chats-circle-duotone"
                      />
                      <Metric
                        label="Waiter calls (period)"
                        value={food.summary?.waiterCallsInPeriod ?? 0}
                        icon="ph:bell-ringing-duotone"
                      />
                      <Metric
                        label="Bill requests"
                        value={food.summary?.billRequestsInPeriod ?? 0}
                        icon="ph:receipt-duotone"
                      />
                      <Metric
                        label="Dining support"
                        value={food.summary?.diningSupportInPeriod ?? 0}
                        icon="ph:hand-waving-duotone"
                      />
                    </div>
                    <p className="text-xs text-smoke-200">
                      Period{' '}
                      <span className="font-medium text-smoke-300">
                        {food.period?.start?.slice(0, 10)} → {food.period?.end?.slice(0, 10)}
                      </span>
                    </p>
                  </>
                ) : (
                  <EmptyState
                    className="border-none bg-transparent px-4 py-8"
                    icon="ph:bowl-food-duotone"
                    title="Dining track quiet"
                    description="Adoption metrics appear when tenants enable Food & Dining and build floor catalog."
                  />
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Card className="h-full overflow-hidden border-smoke-400/10 shadow-card">
              <CardHeader className="border-b border-fuchsia-900/10 bg-gradient-to-r from-fuchsia-50/40 to-transparent">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon icon="ph:flower-duotone" className="h-5 w-5 text-fuchsia-900/70" aria-hidden />
                  Beauty & Grooming
                </CardTitle>
                <p className="text-sm font-normal text-smoke-200">
                  {beauty?.enabled
                    ? `${beauty.tenantIds?.length ?? 0} tenant(s) with beauty signals in scope`
                    : 'No enabled Beauty & Grooming tenants matched this platform view.'}
                </p>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {beauty?.enabled ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <StatCard
                        icon="ph:armchair-duotone"
                        label="Stations"
                        value={beauty.summary?.beautyStations ?? 0}
                      />
                      <StatCard
                        icon="ph:sparkle-duotone"
                        label="Services"
                        value={beauty.summary?.beautyServices ?? 0}
                      />
                      <StatCard
                        icon="ph:hand-heart-duotone"
                        label="Assistance (period)"
                        value={beauty.summary?.assistanceRequestsInPeriod ?? 0}
                      />
                      <StatCard
                        icon="ph:chats-circle-duotone"
                        label="Guest sessions"
                        value={beauty.summary?.conversationSessionsInPeriod ?? 0}
                      />
                    </div>
                    <p className="text-xs text-smoke-200">
                      Period{' '}
                      <span className="font-medium text-smoke-300">
                        {beauty.period?.start?.slice(0, 10)} → {beauty.period?.end?.slice(0, 10)}
                      </span>
                    </p>
                  </>
                ) : (
                  <EmptyState
                    className="border-none bg-transparent px-4 py-8"
                    icon="ph:flower-lotus-duotone"
                    title="Beauty track quiet"
                    description="Adoption metrics appear when tenants enable Beauty & Grooming and publish stations and services."
                  />
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </div>
  );
}
