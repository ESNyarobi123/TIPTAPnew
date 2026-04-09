'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { AnalyticsInsights, type AnalyticsTabId } from '@/components/analytics/analytics-views';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { TabList } from '@/components/ui/tabs';
import {
  analyticsBeautyGrooming,
  analyticsFoodDining,
  analyticsOperations,
  analyticsOverview,
  analyticsPayments,
  analyticsRatings,
  analyticsTips,
} from '@/lib/api/analytics';
import { ApiError } from '@/lib/api/client';
import { defaultDateRange } from '@/lib/format';
import { getStoredToken } from '@/lib/auth/storage';
import { useScope } from '@/providers/scope-provider';

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'payments', label: 'Payments' },
  { id: 'tips', label: 'Tips' },
  { id: 'ratings', label: 'Ratings' },
  { id: 'operations', label: 'Operations' },
  { id: 'food', label: 'Food & Dining' },
  { id: 'beauty', label: 'Beauty & Grooming' },
] as const;

export default function AnalyticsPage() {
  const { tenantId, branchId, loading: scopeLoading } = useScope();
  const def = defaultDateRange();
  const [startDate, setStartDate] = useState(def.startDate);
  const [endDate, setEndDate] = useState(def.endDate);
  const [tab, setTab] = useState<AnalyticsTabId>('overview');
  const [payload, setPayload] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const q = {
    tenantId: tenantId ?? undefined,
    branchId: branchId ?? undefined,
    startDate,
    endDate,
    groupBy: 'day' as const,
  };

  const load = useCallback(async () => {
    const token = getStoredToken();
    if (!token || scopeLoading) {
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      let data: unknown;
      switch (tab) {
        case 'overview':
          data = await analyticsOverview(token, q);
          break;
        case 'payments':
          data = await analyticsPayments(token, q);
          break;
        case 'tips':
          data = await analyticsTips(token, q);
          break;
        case 'ratings':
          data = await analyticsRatings(token, q);
          break;
        case 'operations':
          data = await analyticsOperations(token, q);
          break;
        case 'food':
          data = await analyticsFoodDining(token, q);
          break;
        case 'beauty':
          data = await analyticsBeautyGrooming(token, q);
          break;
        default:
          data = null;
      }
      setPayload(data);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to load');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [tab, tenantId, branchId, startDate, endDate, scopeLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="Insights"
        title="Analytics"
        description="Scope-aware KPIs, distributions, and trends. Tenant and branch context comes from the top bar; period controls are below."
        action={
          <FilterBar className="!p-3">
            <div className="space-y-1">
              <Label htmlFor="a-start">From</Label>
              <Input
                id="a-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 w-[9.5rem] border-ivory-200 bg-ivory-50"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="a-end">To</Label>
              <Input
                id="a-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 w-[9.5rem] border-ivory-200 bg-ivory-50"
              />
            </div>
          </FilterBar>
        }
      />

      <TabList tabs={[...tabs]} value={tab} onChange={(id) => setTab(id as AnalyticsTabId)} className="w-full" />

      {err ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-5 py-4 text-sm text-rose-900 shadow-soft"
        >
          {err}
        </motion.div>
      ) : null}

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-80 w-full rounded-2xl" />
          </motion.div>
        ) : (
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <AnalyticsInsights tab={tab} payload={payload} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
