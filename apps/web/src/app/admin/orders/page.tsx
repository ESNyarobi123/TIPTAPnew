'use client';

import { Icon } from '@iconify/react';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { StatusChip } from '@/components/ui/status-chip';
import { Table, Td, Th } from '@/components/ui/table';
import { ApiError } from '@/lib/api/client';
import { getStoredToken } from '@/lib/auth/storage';
import { paymentsRecentTransactions } from '@/lib/api/payments-dashboard';
import { formatMinorUnits } from '@/lib/format';
import { toast } from '@/lib/toast';

type TxnRow = {
  id: string;
  tenantId?: string;
  branchId?: string | null;
  type?: string;
  amountCents?: number;
  currency?: string;
  status?: string;
  orderReference?: string;
  externalRef?: string | null;
  lastProviderStatus?: string | null;
  createdAt?: string;
};

export default function AdminOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ items?: TxnRow[]; total?: number; page?: number; pageSize?: number } | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    paymentsRecentTransactions(token, { page: 1, pageSize: 50 })
      .then((r) => setData(r as any))
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load orders'))
      .finally(() => setLoading(false));
  }, []);

  const rows = data?.items ?? [];
  const needle = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!needle) return rows;
    return rows.filter((r) => {
      const hay = [
        r.orderReference,
        r.externalRef,
        r.id,
        r.tenantId,
        r.branchId ?? '',
        r.status,
        r.type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, needle]);

  const completed = filtered.filter((r) => (r.status ?? '').toUpperCase() === 'COMPLETED');
  const completedCents = completed.reduce((a, b) => a + (b.amountCents ?? 0), 0);

  if (!getStoredToken()) {
    return (
      <EmptyState
        variant="premium"
        icon="ph:lock-key-duotone"
        title="Sign in required"
        description="Sign in to view platform orders."
      />
    );
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="platform"
        eyebrow="Revenue stream"
        title="Orders"
        description="Platform-wide order ledger (MVP): powered by payment transactions (orderReference). Filter, scan status, and drill into mismatches via reconciliation."
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon="ph:receipt-duotone" label="Rows loaded" value={rows.length} hint="Latest 50" />
          <StatCard icon="ph:check-circle-duotone" label="Completed" value={completed.length} />
          <StatCard icon="ph:currency-circle-dollar-duotone" label="Completed amount" value={formatMinorUnits(completedCents)} />
          <StatCard icon="ph:warning-octagon-duotone" label="Failed" value={filtered.filter((r) => (r.status ?? '').toUpperCase() === 'FAILED').length} />
        </div>
      )}

      <Card className="border-smoke-400/10 shadow-card">
        <CardHeader className="border-b border-smoke-400/[0.06]">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon icon="ph:list-magnifying-glass-duotone" className="h-5 w-5 text-violet-900/70" aria-hidden />
            Orders ledger
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <FilterBar>
            <div className="space-y-1">
              <Label htmlFor="o-q">Search</Label>
              <Input
                id="o-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="order ref, status, tenant id…"
                className="h-10 min-w-[16rem]"
              />
            </div>
          </FilterBar>

          {loading ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              variant="premium"
              icon="ph:receipt-duotone"
              title="No orders in this view"
              description="Try clearing filters. This MVP view reads from payment transactions; deeper order objects can be added later."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Status</Th>
                  <Th>Type</Th>
                  <Th>Order ref</Th>
                  <Th>Tenant</Th>
                  <Th>Branch</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap text-xs text-smoke-200">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                    </Td>
                    <Td>
                      <StatusChip status={String(r.status ?? '—')} />
                    </Td>
                    <Td className="text-xs text-smoke-200">{String(r.type ?? '—')}</Td>
                    <Td className="max-w-[220px] truncate text-xs font-medium text-smoke-400">
                      {String(r.orderReference ?? r.id)}
                    </Td>
                    <Td className="text-xs text-smoke-200">{r.tenantId ? r.tenantId.slice(0, 8) : '—'}</Td>
                    <Td className="text-xs text-smoke-200">{r.branchId ? String(r.branchId).slice(0, 8) : '—'}</Td>
                    <Td className="text-right text-xs font-medium tabular-nums text-smoke-400">
                      {formatMinorUnits(r.amountCents ?? 0, r.currency ?? 'USD')}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

