'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartCard } from '@/components/ui/chart-card';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricMini } from '@/components/ui/metric-mini';
import { Table, Td, Th } from '@/components/ui/table';
import { CHART, chartTooltipStyle } from '@/lib/chart-theme';
import { formatMinorUnits } from '@/lib/format';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function bucketLabel(iso: string) {
  return iso.slice(5, 10);
}

const tabs = [
  'overview',
  'payments',
  'tips',
  'ratings',
  'operations',
  'food',
  'beauty',
] as const;
export type AnalyticsTabId = (typeof tabs)[number];

export function AnalyticsInsights({ tab, payload }: { tab: AnalyticsTabId; payload: unknown }) {
  if (!payload || !isRecord(payload)) {
    return (
      <EmptyState
        icon="ph:chart-line-duotone"
        title="No analytics data"
        description="Adjust your date range or tenant scope, then data will appear here."
      />
    );
  }

  switch (tab) {
    case 'overview':
      return <OverviewInsight r={payload} />;
    case 'payments':
      return <PaymentsInsight r={payload} />;
    case 'tips':
      return <TipsInsight r={payload} />;
    case 'ratings':
      return <RatingsInsight r={payload} />;
    case 'operations':
      return <OperationsInsight r={payload} />;
    case 'food':
      return <FoodInsight r={payload} />;
    case 'beauty':
      return <BeautyInsight r={payload} />;
    default:
      return null;
  }
}

function OverviewInsight({ r }: { r: Record<string, unknown> }) {
  const payments = isRecord(r.payments) ? r.payments : null;
  const byStatus = Array.isArray(payments?.byStatus)
    ? (payments.byStatus as { status: string; count: number; amountCents: number }[])
    : [];
  const ratings = isRecord(r.ratings) ? r.ratings : null;
  const pending = typeof payments?.pendingCount === 'number' ? payments.pendingCount : 0;
  const failed = typeof payments?.failedCount === 'number' ? payments.failedCount : 0;
  const completed = byStatus.find((s) => s.status === 'COMPLETED');
  const avg = ratings && typeof ratings.averageScore === 'number' ? ratings.averageScore : null;
  const reviewCount = ratings && typeof ratings.totalCount === 'number' ? ratings.totalCount : 0;

  const barData = byStatus.map((s) => ({
    name: s.status.replace(/_/g, ' '),
    amount: (s.amountCents ?? 0) / 100,
  }));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricMini
          icon="ph:currency-circle-dollar-duotone"
          label="Completed volume"
          value={formatMinorUnits(completed?.amountCents ?? 0)}
          hint={completed ? `${completed.count} transactions` : 'No completed rows'}
        />
        <MetricMini
          icon="ph:clock-countdown-duotone"
          label="Pending payments"
          value={pending}
        />
        <MetricMini icon="ph:warning-octagon-duotone" label="Failed payments" value={failed} />
        <MetricMini
          icon="ph:star-duotone"
          label="Average rating"
          value={avg != null ? avg.toFixed(2) : '—'}
          hint={reviewCount ? `${reviewCount} reviews` : undefined}
        />
      </div>
      {barData.length > 0 ? (
        <ChartCard
          title="Volume by status"
          description="Payment amounts in scope for the selected period."
          contentClassName="h-72 px-6 pb-6"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: CHART.axis, fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={48} />
              <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatMinorUnits(Math.round(v * 100))} contentStyle={chartTooltipStyle} />
              <Bar dataKey="amount" fill={CHART.primary} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}
    </div>
  );
}

function PaymentsInsight({ r }: { r: Record<string, unknown> }) {
  const byStatus = Array.isArray(r.byStatus)
    ? (r.byStatus as { status: string; count: number; amountCents: number }[])
    : [];
  const byType = Array.isArray(r.byType)
    ? (r.byType as { type: string; count: number; amountCents: number }[])
    : [];
  const vol = Array.isArray(r.volumeOverTime)
    ? (r.volumeOverTime as { bucket: string; amountCents: number }[])
    : [];

  const chartData = vol.map((row) => ({
    label: bucketLabel(row.bucket),
    amount: (row.amountCents ?? 0) / 100,
  }));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {byStatus.map((s) => (
          <MetricMini
            key={s.status}
            icon="ph:receipt-duotone"
            label={s.status.replace(/_/g, ' ')}
            value={formatMinorUnits(s.amountCents)}
            hint={`${s.count} tx`}
          />
        ))}
      </div>
      {chartData.length > 0 ? (
        <ChartCard title="Payment volume over time" contentClassName="h-80 px-6 pb-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="payFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={CHART.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} />
              <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatMinorUnits(Math.round(v * 100))} contentStyle={chartTooltipStyle} />
              <Area type="monotone" dataKey="amount" stroke={CHART.primary} strokeWidth={2} fill="url(#payFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}
      {byType.length > 0 ? (
        <ChartCard title="By transaction type" description="Count and volume per type in period.">
          <Table>
            <thead>
              <tr>
                <Th>Type</Th>
                <Th className="text-right">Count</Th>
                <Th className="text-right">Volume</Th>
              </tr>
            </thead>
            <tbody>
              {byType.map((t) => (
                <tr key={t.type}>
                  <Td className="font-medium">{t.type.replace(/_/g, ' ')}</Td>
                  <Td className="text-right tabular-nums">{t.count}</Td>
                  <Td className="text-right tabular-nums">{formatMinorUnits(t.amountCents)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </ChartCard>
      ) : null}
    </div>
  );
}

function TipsInsight({ r }: { r: Record<string, unknown> }) {
  const totals = isRecord(r.totals) ? r.totals : {};
  const cash = typeof totals.cashTipsCents === 'number' ? totals.cashTipsCents : 0;
  const digital = typeof totals.digitalTipsCents === 'number' ? totals.digitalTipsCents : 0;
  const byMode = Array.isArray(r.byModeAndStatus)
    ? (r.byModeAndStatus as { mode: string; status: string; count: number; amountCents: number }[])
    : [];
  const trend = Array.isArray(r.trend)
    ? (r.trend as { bucket: string; amountCents: number }[])
    : [];
  const chartData = trend.map((row) => ({
    label: bucketLabel(row.bucket),
    amount: (row.amountCents ?? 0) / 100,
  }));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricMini icon="ph:hand-coins-duotone" label="Cash tips (scope)" value={formatMinorUnits(cash)} />
        <MetricMini icon="ph:device-mobile-duotone" label="Digital tips (scope)" value={formatMinorUnits(digital)} />
      </div>
      {chartData.length > 0 ? (
        <ChartCard title="Tip trend" description="Tip volume aggregated by period bucket.">
          <div className="h-72 px-2 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} />
                <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatMinorUnits(Math.round(v * 100))} contentStyle={chartTooltipStyle} />
                <Bar dataKey="amount" fill={CHART.primary} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      ) : null}
      {byMode.length > 0 ? (
        <ChartCard title="By mode & status">
          <Table>
            <thead>
              <tr>
                <Th>Mode</Th>
                <Th>Status</Th>
                <Th className="text-right">Count</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {byMode.map((row, i) => (
                <tr key={`${row.mode}-${row.status}-${i}`}>
                  <Td>{row.mode}</Td>
                  <Td>{row.status}</Td>
                  <Td className="text-right tabular-nums">{row.count}</Td>
                  <Td className="text-right tabular-nums">{formatMinorUnits(row.amountCents)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </ChartCard>
      ) : null}
    </div>
  );
}

function RatingsInsight({ r }: { r: Record<string, unknown> }) {
  const overall = isRecord(r.overall) ? r.overall : {};
  const avg = typeof overall.averageScore === 'number' ? overall.averageScore : null;
  const count = typeof overall.count === 'number' ? overall.count : 0;
  const low = isRecord(r.lowRatingAlerts) ? r.lowRatingAlerts : {};
  const lowCount = typeof low.count === 'number' ? low.count : 0;
  const threshold = typeof low.thresholdMaxScore === 'number' ? low.thresholdMaxScore : 2;
  const byTarget = Array.isArray(r.byTargetType)
    ? (r.byTargetType as { targetType: string; averageScore: number | null; count: number }[])
    : [];
  const trend = Array.isArray(r.trend)
    ? (r.trend as { bucket: string; averageScore: number | null; count: number }[])
    : [];
  const chartData = trend.map((row) => ({
    label: bucketLabel(row.bucket),
    score: row.averageScore != null ? Number(row.averageScore.toFixed(2)) : 0,
    reviews: row.count,
  }));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricMini icon="ph:star-duotone" label="Average score" value={avg != null ? avg.toFixed(2) : '—'} hint={`${count} ratings`} />
        <MetricMini
          icon="ph:warning-duotone"
          label="Low scores"
          value={lowCount}
          hint={`≤ ${threshold} stars`}
        />
        <MetricMini icon="ph:users-duotone" label="Target breakdown" value={byTarget.length} hint="Segments below" />
      </div>
      {chartData.some((d) => d.score > 0) ? (
        <ChartCard title="Average score trend">
          <div className="h-72 px-2 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} />
                <YAxis domain={[0, 5]} tick={{ fill: CHART.axis, fontSize: 11 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="score" stroke={CHART.primary} strokeWidth={2} dot={{ fill: CHART.primary, r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      ) : null}
      {byTarget.length > 0 ? (
        <ChartCard title="By target type">
          <Table>
            <thead>
              <tr>
                <Th>Target</Th>
                <Th className="text-right">Avg</Th>
                <Th className="text-right">Count</Th>
              </tr>
            </thead>
            <tbody>
              {byTarget.map((t) => (
                <tr key={t.targetType}>
                  <Td className="font-medium">{t.targetType.replace(/_/g, ' ')}</Td>
                  <Td className="text-right tabular-nums">
                    {t.averageScore != null ? t.averageScore.toFixed(2) : '—'}
                  </Td>
                  <Td className="text-right tabular-nums">{t.count}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </ChartCard>
      ) : null}
    </div>
  );
}

function OperationsInsight({ r }: { r: Record<string, unknown> }) {
  const wc = isRecord(r.waiterCalls) ? r.waiterCalls : null;
  const br = isRecord(r.billRequests) ? r.billRequests : null;
  const ar = isRecord(r.assistanceRequests) ? r.assistanceRequests : null;
  const ds = isRecord(r.diningCustomerService) ? r.diningCustomerService : null;

  const line = (trend: { bucket: string; count: number }[] | undefined, color: string) =>
    (trend ?? []).map((x) => ({
      label: bucketLabel(x.bucket),
      count: x.count,
      stroke: color,
    }));

  const waiterTrend = line(wc?.trend as { bucket: string; count: number }[], CHART.primary);
  const billTrend = line(br?.trend as { bucket: string; count: number }[], CHART.accentLine);
  const assistTrend = line(ar?.trend as { bucket: string; count: number }[], CHART.primaryMuted as string);

  const mergeKeys = [...new Set([...waiterTrend.map((d) => d.label), ...billTrend.map((d) => d.label), ...assistTrend.map((d) => d.label)])];
  const merged = mergeKeys.sort().map((label) => {
    const a = waiterTrend.find((x) => x.label === label)?.count ?? 0;
    const b = billTrend.find((x) => x.label === label)?.count ?? 0;
    const c = assistTrend.find((x) => x.label === label)?.count ?? 0;
    return { label, waiter: a, bills: b, assist: c };
  });

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricMini icon="ph:bell-ringing-duotone" label="Waiter calls" value={typeof wc?.total === 'number' ? wc.total : 0} />
        <MetricMini icon="ph:receipt-duotone" label="Bill requests" value={typeof br?.total === 'number' ? br.total : 0} />
        <MetricMini icon="ph:hand-waving-duotone" label="Assistance" value={typeof ar?.total === 'number' ? ar.total : 0} />
        <MetricMini icon="ph:headset-duotone" label="Dining support" value={typeof ds?.total === 'number' ? ds.total : 0} />
      </div>
      {merged.length > 0 ? (
        <ChartCard title="Operational signals over time" description="Waiter calls, bills, and assistance — aligned by day bucket.">
          <div className="h-80 px-2 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={merged}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} />
                <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="waiter" name="Waiter calls" stroke={CHART.primary} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="bills" name="Bills" stroke={CHART.accentLine} strokeWidth={2} dot={false} />
                <Line
                  type="monotone"
                  dataKey="assist"
                  name="Assist"
                  stroke={CHART.axis}
                  strokeOpacity={0.85}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      ) : null}
    </div>
  );
}

function FoodInsight({ r }: { r: Record<string, unknown> }) {
  if (r.enabled !== true) {
    return (
      <EmptyState
        icon="ph:fork-knife-duotone"
        title="Food & Dining lens inactive"
        description="Enable the FOOD_DINING category for this tenant to unlock dining-specific counts — tables, menus, sessions, and floor signals."
      />
    );
  }
  const summary = isRecord(r.summary) ? r.summary : {};
  const items = [
    ['Dining tables', 'diningTables', 'ph:armchair-duotone'],
    ['Menu items', 'menuItems', 'ph:list-bullets-duotone'],
    ['Conversation sessions', 'conversationSessions', 'ph:chats-circle-duotone'],
    ['Waiter calls (period)', 'waiterCallsInPeriod', 'ph:bell-ringing-duotone'],
    ['Bill requests (period)', 'billRequestsInPeriod', 'ph:receipt-duotone'],
    ['Dining support (period)', 'diningSupportInPeriod', 'ph:hand-palm-duotone'],
  ] as const;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([label, key, icon]) => (
        <MetricMini
          key={key}
          icon={icon}
          label={label}
          value={typeof summary[key] === 'number' ? summary[key] : 0}
        />
      ))}
    </div>
  );
}

function BeautyInsight({ r }: { r: Record<string, unknown> }) {
  if (r.enabled !== true) {
    return (
      <EmptyState
        icon="ph:flower-duotone"
        title="Beauty & Grooming lens inactive"
        description="Enable the BEAUTY_GROOMING category for this tenant to unlock stations, services, assistance, and session counts."
      />
    );
  }
  const summary = isRecord(r.summary) ? r.summary : {};
  const items = [
    ['Beauty stations', 'beautyStations', 'ph:armchair-duotone'],
    ['Beauty services', 'beautyServices', 'ph:sparkle-duotone'],
    ['Assistance (period)', 'assistanceRequestsInPeriod', 'ph:hand-waving-duotone'],
    ['Conversation sessions', 'conversationSessionsInPeriod', 'ph:chats-circle-duotone'],
  ] as const;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([label, key, icon]) => (
        <MetricMini
          key={key}
          icon={icon}
          label={label}
          value={typeof summary[key] === 'number' ? summary[key] : 0}
        />
      ))}
    </div>
  );
}
