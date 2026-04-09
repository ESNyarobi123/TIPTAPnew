'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusChip } from '@/components/ui/status-chip';
import { Table, Td, Th } from '@/components/ui/table';
import { ChartCard } from '@/components/ui/chart-card';
import { Skeleton } from '@/components/ui/skeleton';
import { listAuditLogs } from '@/lib/api/audit-logs';
import { ApiError } from '@/lib/api/client';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';

export default function AdminAuditRiskPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ items?: Record<string, unknown>[]; total?: number } | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    listAuditLogs(token, { page: 1, pageSize: 25 })
      .then((raw) => setData(raw as { items?: Record<string, unknown>[]; total?: number }))
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load audit logs'))
      .finally(() => setLoading(false));
  }, []);

  if (!getStoredToken()) {
    return (
      <EmptyState
        variant="premium"
        icon="ph:lock-key-duotone"
        title="Sign in required"
        description="Sign in to review platform audit history."
      />
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="platform"
        eyebrow="Risk & compliance"
        title="Audit & risk"
        description="Immutable platform audit stream — newest events first. Open any row for structured detail and correlation identifiers."
      />

      <ChartCard
        title="Recent events"
        description={
          data?.total != null
            ? `${data.total.toLocaleString()} event(s) visible to your platform scope`
            : 'Latest audit entries'
        }
        contentClassName="px-0 pb-0"
      >
        {loading ? (
          <div className="space-y-3 px-6 py-8">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ) : items.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-smoke-200">No audit entries returned for this query.</p>
        ) : (
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
                <tr key={String(row.id)}>
                  <Td className="whitespace-nowrap text-xs text-smoke-200">
                    {row.createdAt ? new Date(String(row.createdAt)).toLocaleString() : '—'}
                  </Td>
                  <Td>
                    <StatusChip status={String(row.action ?? '—')} />
                  </Td>
                  <Td className="text-xs">
                    <span className="font-medium text-smoke-400">{String(row.entityType ?? '—')}</span>
                    {row.entityId ? (
                      <span className="mt-0.5 block max-w-[200px] truncate text-[11px] text-smoke-200">
                        {String(row.entityId)}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="max-w-xs text-sm text-smoke-300">{String(row.summary ?? '—')}</Td>
                  <Td className="text-right">
                    <Link
                      href={`/dashboard/audit-logs/${encodeURIComponent(String(row.id))}`}
                      className="text-xs font-semibold uppercase tracking-wide text-violet-900 underline-offset-4 hover:underline"
                    >
                      Open
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </ChartCard>
    </div>
  );
}
