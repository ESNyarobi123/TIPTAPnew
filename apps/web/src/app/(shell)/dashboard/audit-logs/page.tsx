'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChartCard } from '@/components/ui/chart-card';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusChip } from '@/components/ui/status-chip';
import { Table, Td, Th } from '@/components/ui/table';
import { ApiError } from '@/lib/api/client';
import { listAuditLogs } from '@/lib/api/audit-logs';
import { getStoredToken } from '@/lib/auth/storage';
import { useScope } from '@/providers/scope-provider';

export default function AuditLogsPage() {
  const { tenantId, branchId, loading: scopeLoading } = useScope();
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState<string>('');
  const [data, setData] = useState<{ items?: Record<string, unknown>[]; total?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token || scopeLoading) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    listAuditLogs(token, {
      tenantId: tenantId ?? undefined,
      branchId: branchId ?? undefined,
      page,
      pageSize: 25,
      ...(entityType.trim() ? { entityType: entityType.trim() } : {}),
      ...(action ? { action: action as 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'ACCESS' | 'CONFIG_CHANGE' } : {}),
    })
      .then((r) => {
        if (!cancelled) {
          setData(r as { items?: Record<string, unknown>[]; total?: number });
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setErr(e instanceof ApiError ? e.message : 'Failed to load audit logs');
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
  }, [tenantId, branchId, page, scopeLoading, entityType, action]);

  const items = data?.items ?? [];
  const activeFilters = Number(Boolean(entityType.trim())) + Number(Boolean(action));
  const scopeLabel = branchId ? 'Branch scope' : tenantId ? 'Business scope' : 'Global scope';

  return (
    <div className="space-y-8">
      <SectionHeader
        tone="business"
        eyebrow="Compliance"
        title="Audit trail"
        description="Scoped event stream."
        action={
          <FilterBar className="!p-3">
            <div className="space-y-1">
              <Label htmlFor="al-entity">Entity type</Label>
              <Input
                id="al-entity"
                placeholder="e.g. PaymentTransaction"
                value={entityType}
                onChange={(e) => {
                  setPage(1);
                  setEntityType(e.target.value);
                }}
                className="h-10 min-w-[10rem]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="al-action">Action</Label>
              <Select
                id="al-action"
                value={action}
                onChange={(e) => {
                  setPage(1);
                  setAction(e.target.value);
                }}
                className="h-10 min-w-[10rem] text-sm"
              >
                <option value="">Any</option>
                {(['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'ACCESS', 'CONFIG_CHANGE'] as const).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </div>
          </FilterBar>
        }
      />

      {!tenantId ? (
        <EmptyState
          variant="premium"
          icon="fluent-color:building-store-24"
          title="Pick a business"
          description="Choose a business to open the audit stream."
        />
      ) : null}

      {err ? (
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-5 py-4 text-sm text-rose-900">{err}</div>
      ) : null}

      {tenantId ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Card className="border-smoke-400/10 bg-ivory-50/92">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Events</p>
                <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">
                  {data?.total != null ? data.total.toLocaleString() : '—'}
                </p>
              </div>
              <Icon icon="fluent-color:book-database-32" className="h-10 w-10" aria-hidden />
            </CardContent>
          </Card>
          <Card className="border-smoke-400/10 bg-ivory-50/92">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Scope</p>
                <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">{scopeLabel}</p>
              </div>
              <Icon icon="fluent-color:building-people-24" className="h-10 w-10" aria-hidden />
            </CardContent>
          </Card>
          <Card className="border-smoke-400/10 bg-ivory-50/92">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Filters</p>
                <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">{activeFilters}</p>
              </div>
              <Icon icon="fluent-color:contact-card-48" className="h-10 w-10" aria-hidden />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tenantId ? (
      <ChartCard
        title="Event stream"
        description={data?.total != null ? `${data.total.toLocaleString()} rows` : 'Recent rows'}
        action={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-full"
            >
              Prev
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || (data?.total != null && page * 25 >= data.total)}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full"
            >
              Next
            </Button>
          </div>
        }
        contentClassName="px-0 pb-0"
      >
        {loading ? (
          <p className="px-6 py-10 text-center text-sm text-smoke-200">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-smoke-200">No entries.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Action</Th>
                  <Th>Entity</Th>
                  <Th>Summary</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={String(row.id)} className="transition-colors hover:bg-smoke-400/[0.025]">
                    <Td className="whitespace-nowrap text-xs text-smoke-200">
                      {row.createdAt ? new Date(String(row.createdAt)).toLocaleString() : '—'}
                    </Td>
                    <Td>
                      <StatusChip status={String(row.action ?? '—')} />
                    </Td>
                    <Td className="text-xs">
                      <span className="font-medium text-smoke-400">{String(row.entityType ?? '—')}</span>
                      {row.entityId ? (
                        <span className="mt-0.5 block max-w-[200px] truncate font-mono text-[11px] text-smoke-200">
                          {String(row.entityId)}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="max-w-xs text-sm text-smoke-300">{String(row.summary ?? '—')}</Td>
                    <Td className="text-right">
                      <Link
                        href={`/dashboard/audit-logs/${encodeURIComponent(String(row.id))}`}
                        className="text-xs font-semibold uppercase tracking-wide text-smoke-400 underline-offset-4 hover:underline"
                      >
                        Open
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </ChartCard>
      ) : null}
    </div>
  );
}
