'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { StatusChip } from '@/components/ui/status-chip';
import { Table, Td, Th } from '@/components/ui/table';
import { analyticsTips } from '@/lib/api/analytics';
import { ApiError } from '@/lib/api/client';
import {
  listAssistanceRequests,
  listBeautyBookings,
  listServices,
  listStations,
} from '@/lib/api/beauty-grooming';
import { listRatings } from '@/lib/api/ratings';
import { listCompensationFeed, listStaff, type CompensationFeedRow } from '@/lib/api/staff';
import { getStoredToken } from '@/lib/auth/storage';
import { hasCategory } from '@/lib/business-categories';
import { formatMinorUnits } from '@/lib/format';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

type BookingRow = {
  id: string;
  bookingNumber: string;
  status: string;
  totalCents: number;
  currency: string;
  customerName?: string | null;
  customerPhone?: string | null;
  scheduledAt?: string | null;
  createdAt?: string;
  serviceCount: number;
};

type StationRow = {
  id: string;
  code: string;
  label?: string | null;
  status?: string;
};

type AssistanceRow = {
  id: string;
  status: string;
  createdAt?: string;
  stationId?: string | null;
  staffId?: string | null;
  notes?: string | null;
};

type StaffRow = {
  id: string;
  displayName: string;
  roleInTenant: string;
  status: string;
};

type RatingRow = {
  id: string;
  score: number;
  maxScore?: number;
  comment?: string | null;
  createdAt?: string | null;
};

function asBooking(row: unknown): BookingRow | null {
  const value = (row ?? {}) as Record<string, unknown>;
  const id = typeof value.id === 'string' ? value.id : '';
  const bookingNumber = typeof value.bookingNumber === 'string' ? value.bookingNumber : '';
  if (!id || !bookingNumber) return null;
  const services = Array.isArray(value.services) ? value.services : [];
  return {
    id,
    bookingNumber,
    status: typeof value.status === 'string' ? value.status : 'BOOKED',
    totalCents: typeof value.totalCents === 'number' ? value.totalCents : 0,
    currency: typeof value.currency === 'string' ? value.currency : 'TZS',
    customerName: typeof value.customerName === 'string' ? value.customerName : null,
    customerPhone: typeof value.customerPhone === 'string' ? value.customerPhone : null,
    scheduledAt: typeof value.scheduledAt === 'string' ? value.scheduledAt : (value.scheduledAt === null ? null : undefined),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : undefined,
    serviceCount: services.length,
  };
}

function asStation(row: unknown): StationRow | null {
  const value = (row ?? {}) as Record<string, unknown>;
  const id = typeof value.id === 'string' ? value.id : '';
  const code = typeof value.code === 'string' ? value.code : '';
  if (!id || !code) return null;
  return {
    id,
    code,
    label: typeof value.label === 'string' ? value.label : null,
    status: typeof value.status === 'string' ? value.status : undefined,
  };
}

function asAssistance(row: unknown): AssistanceRow | null {
  const value = (row ?? {}) as Record<string, unknown>;
  const id = typeof value.id === 'string' ? value.id : '';
  if (!id) return null;
  return {
    id,
    status: typeof value.status === 'string' ? value.status : 'PENDING',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : undefined,
    stationId: typeof value.stationId === 'string' ? value.stationId : (value.stationId === null ? null : undefined),
    staffId: typeof value.staffId === 'string' ? value.staffId : (value.staffId === null ? null : undefined),
    notes: typeof value.notes === 'string' ? value.notes : (value.notes === null ? null : undefined),
  };
}

function asStaff(row: unknown): StaffRow | null {
  const value = (row ?? {}) as Record<string, unknown>;
  const id = typeof value.id === 'string' ? value.id : '';
  const displayName = typeof value.displayName === 'string' ? value.displayName : '';
  if (!id || !displayName) return null;
  return {
    id,
    displayName,
    roleInTenant: typeof value.roleInTenant === 'string' ? value.roleInTenant : 'SERVICE_STAFF',
    status: typeof value.status === 'string' ? value.status : 'ACTIVE',
  };
}

function asRating(row: unknown): RatingRow | null {
  const value = (row ?? {}) as Record<string, unknown>;
  const id = typeof value.id === 'string' ? value.id : '';
  if (!id || typeof value.score !== 'number') return null;
  return {
    id,
    score: value.score,
    maxScore: typeof value.maxScore === 'number' ? value.maxScore : undefined,
    comment: typeof value.comment === 'string' ? value.comment : (value.comment === null ? null : undefined),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : (value.createdAt === null ? null : undefined),
  };
}

function tipsTotal(raw: unknown): number {
  const totals = ((raw ?? {}) as { totals?: Record<string, unknown> }).totals ?? {};
  return (typeof totals.cashTipsCents === 'number' ? totals.cashTipsCents : 0) +
    (typeof totals.digitalTipsCents === 'number' ? totals.digitalTipsCents : 0);
}

function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function BeautyGroomingIndexPage() {
  const { tenantId, branchId, branches, tenantCategories } = useScope();
  const enabled = hasCategory(tenantCategories, 'BEAUTY_GROOMING');
  const branchName = branchId ? branches.find((branch) => branch.id === branchId)?.name ?? 'Selected branch' : 'All branches';

  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [stations, setStations] = useState<StationRow[]>([]);
  const [assistanceRows, setAssistanceRows] = useState<AssistanceRow[]>([]);
  const [staffRows, setStaffRows] = useState<StaffRow[]>([]);
  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [tipsCents, setTipsCents] = useState(0);
  const [compensationRows, setCompensationRows] = useState<CompensationFeedRow[]>([]);
  const [serviceCount, setServiceCount] = useState(0);

  useEffect(() => {
    const token = getStoredToken();
    if (!token || !tenantId || !enabled) {
      setBookings([]);
      setStations([]);
      setAssistanceRows([]);
      setStaffRows([]);
      setRatings([]);
      setTipsCents(0);
      setCompensationRows([]);
      setServiceCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.allSettled([
      listBeautyBookings(token, { tenantId, branchId: branchId ?? null }),
      listStations(token, { tenantId, branchId: branchId ?? null }),
      listAssistanceRequests(token, { tenantId, branchId: branchId ?? null }),
      listStaff(token, tenantId),
      analyticsTips(token, { tenantId, branchId: branchId ?? undefined }),
      listRatings(token, { tenantId, targetType: 'STAFF' }),
      listCompensationFeed(token, { tenantId, branchId: branchId ?? null }),
      listServices(token, { tenantId, branchId: branchId ?? null, activeOnly: true }),
    ])
      .then((results) => {
        const [bookingsResult, stationsResult, assistanceResult, staffResult, tipsResult, ratingsResult, payResult, servicesResult] = results;

        setBookings(
          bookingsResult.status === 'fulfilled'
            ? (Array.isArray(bookingsResult.value) ? bookingsResult.value : [])
                .map(asBooking)
                .filter((row): row is BookingRow => row != null)
            : [],
        );
        setStations(
          stationsResult.status === 'fulfilled'
            ? (Array.isArray(stationsResult.value) ? stationsResult.value : [])
                .map(asStation)
                .filter((row): row is StationRow => row != null)
            : [],
        );
        setAssistanceRows(
          assistanceResult.status === 'fulfilled'
            ? (Array.isArray(assistanceResult.value) ? assistanceResult.value : [])
                .map(asAssistance)
                .filter((row): row is AssistanceRow => row != null)
            : [],
        );
        setStaffRows(
          staffResult.status === 'fulfilled'
            ? (Array.isArray(staffResult.value) ? staffResult.value : [])
                .map(asStaff)
                .filter((row): row is StaffRow => row != null)
            : [],
        );
        setTipsCents(tipsResult.status === 'fulfilled' ? tipsTotal(tipsResult.value) : 0);
        setRatings(
          ratingsResult.status === 'fulfilled'
            ? (Array.isArray(ratingsResult.value) ? ratingsResult.value : [])
                .map(asRating)
                .filter((row): row is RatingRow => row != null)
            : [],
        );
        setCompensationRows(payResult.status === 'fulfilled' ? payResult.value : []);
        setServiceCount(
          servicesResult.status === 'fulfilled' ? (Array.isArray(servicesResult.value) ? servicesResult.value.length : 0) : 0,
        );
      })
      .catch((error) => toast.error(error instanceof ApiError ? error.message : 'Could not load studio desk'))
      .finally(() => setLoading(false));
  }, [tenantId, branchId, enabled]);

  const stationMap = useMemo(
    () =>
      new Map(
        stations.map((station) => [
          station.id,
          `${station.code}${station.label ? ` · ${station.label}` : ''}`,
        ]),
      ),
    [stations],
  );

  const liveBookings = useMemo(
    () => bookings.filter((row) => !['COMPLETED', 'PAID', 'CANCELLED', 'NO_SHOW'].includes(row.status)).slice(0, 6),
    [bookings],
  );
  const activeStaff = useMemo(() => staffRows.filter((row) => row.status === 'ACTIVE'), [staffRows]);
  const scheduledPayroll = useMemo(
    () =>
      compensationRows
        .filter((row) => row.status === 'SCHEDULED' || row.status === 'APPROVED')
        .reduce((sum, row) => sum + row.amountCents, 0),
    [compensationRows],
  );
  const paidPayroll = useMemo(
    () => compensationRows.filter((row) => row.status === 'PAID').reduce((sum, row) => sum + row.amountCents, 0),
    [compensationRows],
  );
  const averageRating = useMemo(() => {
    if (!ratings.length) return null;
    return ratings.reduce((sum, row) => sum + row.score, 0) / ratings.length;
  }, [ratings]);
  const feedbackRows = useMemo(() => ratings.filter((row) => row.comment?.trim()).slice(0, 4), [ratings]);

  if (!tenantId) {
    return (
      <EmptyState
        variant="premium"
        icon="fluent-color:building-shop-24"
        title="Pick a business"
        description="Choose a business to open studio tools."
      />
    );
  }

  if (!enabled) {
    return (
      <EmptyState
        variant="premium"
        icon="fluent-color:person-starburst-48"
        title="Beauty not enabled"
        description="This business is not set to Beauty & Grooming."
        action={
          <Button asChild className="rounded-full shadow-soft">
            <Link href="/dashboard/settings/categories">Open categories</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Beauty & Grooming" title="Salon desk" description={branchName} tone="business" />

      <Card className="overflow-hidden border-smoke-400/10 bg-[linear-gradient(135deg,rgba(255,253,248,0.98),rgba(233,244,239,0.9))] shadow-card">
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Icon icon="fluent-color:person-feedback-48" className="h-11 w-11" aria-hidden />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Salon workspace</p>
                <h2 className="font-display text-2xl font-semibold text-smoke-400">Services, stations, providers, and reception flow.</h2>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-smoke-400/[0.08] bg-white/78 px-3 py-1.5 text-[11px] font-medium text-smoke-300 shadow-soft">
                {serviceCount} live services
              </span>
              <span className="rounded-full border border-smoke-400/[0.08] bg-white/78 px-3 py-1.5 text-[11px] font-medium text-smoke-300 shadow-soft">
                {stations.length} stations
              </span>
              <span className="rounded-full border border-smoke-400/[0.08] bg-white/78 px-3 py-1.5 text-[11px] font-medium text-smoke-300 shadow-soft">
                {activeStaff.length} active providers
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Button asChild className="rounded-full shadow-soft">
              <Link href="/dashboard/beauty-grooming/catalog">Catalog</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/dashboard/beauty-grooming/ops">Live desk</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/dashboard/staff">Providers</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard icon="fluent-color:calendar-agenda-24" label="Live bookings" value={liveBookings.length} hint={`${bookings.length} total`} />
          <StatCard icon="fluent-color:chair-24" label="Stations" value={stations.length} hint={branchName} />
          <StatCard icon="fluent-color:chat-help-24" label="Reception queue" value={assistanceRows.length} hint="Open requests" />
          <StatCard icon="fluent-color:person-starburst-48" label="Providers" value={activeStaff.length} hint="Active staff" />
          <StatCard icon="fluent-color:money-hand-24" label="Scheduled pay" value={formatMinorUnits(scheduledPayroll)} hint={`Paid ${formatMinorUnits(paidPayroll)}`} />
          <StatCard
            icon="fluent-color:person-feedback-48"
            label="Guest pulse"
            value={averageRating != null ? averageRating.toFixed(2) : '—'}
            hint={ratings.length ? `${ratings.length} ratings · ${formatMinorUnits(tipsCents)} tips` : formatMinorUnits(tipsCents)}
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Card className="border-smoke-400/10 shadow-card">
          <CardHeader className="border-b border-smoke-400/[0.06]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Bookings</p>
                <CardTitle className="mt-2 text-xl">Service lane</CardTitle>
              </div>
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link href="/dashboard/beauty-grooming/ops">Open queue</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {liveBookings.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>Booking</Th>
                    <Th>Status</Th>
                    <Th>Services</Th>
                    <Th>Total</Th>
                    <Th>Time</Th>
                  </tr>
                </thead>
                <tbody>
                  {liveBookings.map((row) => (
                    <tr key={row.id}>
                      <Td>
                        <div className="font-medium text-smoke-400">{row.bookingNumber}</div>
                        <div className="text-xs text-smoke-200">{row.customerName ?? row.customerPhone ?? 'Walk-in guest'}</div>
                      </Td>
                      <Td><StatusChip status={row.status} /></Td>
                      <Td className="text-smoke-200">{row.serviceCount}</Td>
                      <Td className="font-medium">{formatMinorUnits(row.totalCents, row.currency)}</Td>
                      <Td className="text-xs text-smoke-200">{formatWhen(row.scheduledAt ?? row.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState icon="fluent-color:calendar-agenda-24" title="No live bookings" description="Walk-ins and bookings will appear here." />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-smoke-400/10 shadow-card">
            <CardHeader className="border-b border-smoke-400/[0.06]">
              <CardTitle className="text-base">Reception queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {assistanceRows.length ? (
                assistanceRows.slice(0, 6).map((row) => (
                  <div key={row.id} className="rounded-2xl border border-smoke-400/[0.08] bg-ivory-100/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-smoke-400">Assistance request</p>
                        <p className="mt-1 text-xs text-smoke-200">
                          {row.stationId ? stationMap.get(row.stationId) ?? row.stationId.slice(0, 8) : 'Front desk'}
                        </p>
                      </div>
                      <StatusChip status={row.status} />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-smoke-200">
                      <span>{row.notes?.trim() ? row.notes : 'No extra note'}</span>
                      <span>{formatWhen(row.createdAt)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState icon="fluent-color:chat-help-24" title="No open requests" description="Reception is clear." />
              )}
            </CardContent>
          </Card>

          <Card className="border-smoke-400/10 shadow-card">
            <CardHeader className="border-b border-smoke-400/[0.06]">
              <CardTitle className="text-base">Payroll & guest pulse</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-smoke-400/[0.08] bg-ivory-100/70 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Scheduled</p>
                  <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">{formatMinorUnits(scheduledPayroll)}</p>
                </div>
                <div className="rounded-2xl border border-smoke-400/[0.08] bg-ivory-100/70 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Tips (30d)</p>
                  <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">{formatMinorUnits(tipsCents)}</p>
                </div>
              </div>

              <div className="space-y-3">
                {compensationRows.slice(0, 3).map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border border-smoke-400/[0.08] bg-ivory-100/70 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-smoke-400">{row.staffName}</p>
                      <p className="text-xs text-smoke-200">{row.type.replaceAll('_', ' ')} · {row.branchName ?? branchName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-smoke-400">{formatMinorUnits(row.amountCents, row.currency)}</p>
                      <p className="text-xs text-smoke-200">{row.status}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {feedbackRows.length ? (
                  feedbackRows.map((row) => (
                    <div key={row.id} className="rounded-2xl border border-smoke-400/[0.08] bg-white/85 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-smoke-400">
                          {row.score}{row.maxScore ? ` / ${row.maxScore}` : ''}
                        </p>
                        <p className="text-xs text-smoke-200">{formatWhen(row.createdAt)}</p>
                      </div>
                      <p className="mt-2 text-sm text-smoke-200">{row.comment}</p>
                    </div>
                  ))
                ) : (
                  <EmptyState icon="fluent-color:person-feedback-48" title="No written feedback" description="Guest comments will appear here." />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
