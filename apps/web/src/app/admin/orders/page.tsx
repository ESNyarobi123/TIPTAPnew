'use client';

import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { StatusChip } from '@/components/ui/status-chip';
import { Table, Td, Th } from '@/components/ui/table';
import { adminGetOrderCenter, type AdminOrderCenterResponse } from '@/lib/api/admin-platform';
import { ApiError } from '@/lib/api/client';
import { getStoredToken } from '@/lib/auth/storage';
import { formatMinorUnits } from '@/lib/format';
import { toast } from '@/lib/toast';

const kindOptions = ['ALL', 'DINING_ORDER', 'BEAUTY_BOOKING', 'LEDGER_ONLY'] as const;
const commercialOptions = ['ALL', 'FULFILLMENT_ACTIVE', 'AWAITING_PAYMENT', 'CLOSED', 'PAYMENT_ATTENTION', 'CANCELLED'] as const;
const paymentOptions = ['ALL', 'UNPAID', 'PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'] as const;

export default function AdminOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<string>('ALL');
  const [commercialStatus, setCommercialStatus] = useState<string>('ALL');
  const [paymentStatus, setPaymentStatus] = useState<string>('ALL');
  const [data, setData] = useState<AdminOrderCenterResponse | null>(null);

  async function load() {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await adminGetOrderCenter(token, {
        q: q || undefined,
        kind: kind !== 'ALL' ? kind : undefined,
        commercialStatus: commercialStatus !== 'ALL' ? commercialStatus : undefined,
        paymentStatus: paymentStatus !== 'ALL' ? paymentStatus : undefined,
        page,
        pageSize: 25,
      });
      setData(res);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load order center');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [q, kind, commercialStatus, paymentStatus, page]);

  if (!getStoredToken()) {
    return (
      <EmptyState
        variant="premium"
        icon="fluent-color:lock-shield-24"
        title="Sign in required"
        description="Sign in to view platform orders."
      />
    );
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 25;
  const canPrev = page > 1;
  const canNext = page * pageSize < total;

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="platform"
        eyebrow="Commercial lane"
        title="Order center"
        description="One view for dining orders, beauty bookings, and unlinked payment rows."
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard icon="fluent-color:receipt-bag-24" label="Rows in scope" value={data?.summary.total ?? 0} />
          <StatCard icon="fluent-color:food-48" label="Dining" value={data?.summary.byKind?.DINING_ORDER ?? 0} />
          <StatCard icon="fluent-color:calendar-people-20" label="Beauty" value={data?.summary.byKind?.BEAUTY_BOOKING ?? 0} />
          <StatCard icon="fluent-color:wallet-credit-card-16" label="Awaiting payment" value={data?.summary.byCommercialStatus?.AWAITING_PAYMENT ?? 0} />
          <StatCard icon="fluent-color:money-24" label="Gross in scope" value={formatMinorUnits(data?.summary.grossCents ?? 0)} />
        </div>
      )}

      <Card className="border-smoke-400/10 shadow-card">
        <CardContent className="pt-6">
          <FilterBar>
            <div className="space-y-1">
              <Label htmlFor="order-center-q">Search</Label>
              <Input
                id="order-center-q"
                value={q}
                onChange={(event) => {
                  setPage(1);
                  setQ(event.target.value);
                }}
                placeholder="ref, tenant, customer"
                className="h-10 min-w-[14rem]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="order-center-kind">Lane</Label>
              <Select
                id="order-center-kind"
                value={kind}
                onChange={(event) => {
                  setPage(1);
                  setKind(event.target.value);
                }}
              >
                {kindOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'ALL' ? 'All' : option.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="order-center-commercial">Commercial</Label>
              <Select
                id="order-center-commercial"
                value={commercialStatus}
                onChange={(event) => {
                  setPage(1);
                  setCommercialStatus(event.target.value);
                }}
              >
                {commercialOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'ALL' ? 'All' : option.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="order-center-payment">Payment</Label>
              <Select
                id="order-center-payment"
                value={paymentStatus}
                onChange={(event) => {
                  setPage(1);
                  setPaymentStatus(event.target.value);
                }}
              >
                {paymentOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'ALL' ? 'All' : option.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </div>
          </FilterBar>
        </CardContent>
      </Card>

      <Card className="border-smoke-400/10 shadow-card">
        <CardHeader className="border-b border-smoke-400/[0.06]">
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            <span className="flex items-center gap-2">
              <Icon icon="fluent-color:table-freeze-row-24" className="h-5 w-5" aria-hidden />
              Unified workstream
            </span>
            {data?.windowed ? <Badge variant="warning">Windowed stream</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              variant="premium"
              icon="fluent-color:receipt-off-24"
              title="No rows in this lens"
              description="Change filters or wait for new transactions."
            />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Kind</Th>
                    <Th>Reference</Th>
                    <Th>Workflow</Th>
                    <Th>Payment</Th>
                    <Th>Tenant</Th>
                    <Th>Customer / staff</Th>
                    <Th className="text-right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={`${row.kind}-${row.id}`}>
                      <Td className="whitespace-nowrap text-xs text-smoke-200">
                        {new Date(row.createdAt).toLocaleString()}
                      </Td>
                      <Td>
                        <div className="space-y-1">
                          <Badge
                            variant={
                              row.kind === 'DINING_ORDER'
                                ? 'success'
                                : row.kind === 'BEAUTY_BOOKING'
                                  ? 'warning'
                                  : 'danger'
                            }
                          >
                            {row.kind.replace(/_/g, ' ')}
                          </Badge>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-smoke-200">
                            {row.commercialStatus.replace(/_/g, ' ')}
                          </p>
                        </div>
                      </Td>
                      <Td>
                        <div className="space-y-1">
                          <p className="font-medium text-smoke-400">{row.reference}</p>
                          <p className="text-xs text-smoke-200">
                            {row.payment?.orderReference ?? row.id.slice(0, 8)}
                          </p>
                        </div>
                      </Td>
                      <Td>
                        <StatusChip status={row.workflowStatus} />
                      </Td>
                      <Td>
                        <div className="space-y-1">
                          <StatusChip status={row.paymentStatus} />
                          {row.payment?.externalRef ? (
                            <p className="text-xs text-smoke-200">{row.payment.externalRef}</p>
                          ) : null}
                        </div>
                      </Td>
                      <Td>
                        <div className="space-y-1">
                          <p className="font-medium text-smoke-400">{row.tenant.name}</p>
                          <p className="text-xs text-smoke-200">{row.branch?.name ?? 'No branch'}</p>
                        </div>
                      </Td>
                      <Td>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-smoke-400">{row.customerLabel ?? 'No customer label'}</p>
                          <p className="text-xs text-smoke-200">{row.staffLabel ?? 'No assignee yet'}</p>
                        </div>
                      </Td>
                      <Td className="text-right text-xs font-medium tabular-nums text-smoke-400">
                        {formatMinorUnits(row.amountCents, row.currency)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-xs text-smoke-200">
                  Showing {items.length} of {total} row(s)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!canPrev}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    className="rounded-xl border border-smoke-400/15 bg-ivory-50 px-4 py-2 text-sm font-medium text-smoke-400 shadow-soft disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <div className="rounded-xl border border-smoke-400/10 bg-ivory-50 px-3 py-2 text-sm text-smoke-300">
                    Page {page}
                  </div>
                  <button
                    type="button"
                    disabled={!canNext}
                    onClick={() => setPage((current) => current + 1)}
                    className="rounded-xl border border-smoke-400/15 bg-ivory-50 px-4 py-2 text-sm font-medium text-smoke-400 shadow-soft disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
