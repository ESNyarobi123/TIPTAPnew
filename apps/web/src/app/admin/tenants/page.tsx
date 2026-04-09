'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, Td, Th } from '@/components/ui/table';
import { StatCard } from '@/components/ui/stat-card';
import { StatusChip } from '@/components/ui/status-chip';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { listTenants } from '@/lib/api/tenants-branches';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';

type TenantRow = { id: string; name?: string; status?: string; slug?: string; createdAt?: string };

function asRow(x: unknown): TenantRow {
  const o = (x ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    name: typeof o.name === 'string' ? o.name : undefined,
    status: typeof o.status === 'string' ? o.status : undefined,
    slug: typeof o.slug === 'string' ? o.slug : undefined,
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : undefined,
  };
}

function shortenId(id: string) {
  if (id.length <= 12) {
    return id;
  }
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export default function AdminTenantsPage() {
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    listTenants(token)
      .then((raw) => setRows((Array.isArray(raw) ? raw : []).map(asRow).filter((r) => r.id)))
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load tenants'))
      .finally(() => setLoading(false));
  }, []);

  const activeLike = rows.filter((r) => (r.status ?? '').toUpperCase() === 'ACTIVE').length;

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="platform"
        eyebrow="Directory"
        title="Tenants"
        description="Platform-visible merchants — structured for operators, not spreadsheet dumps. Status and identifiers are scannable at a glance."
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
          <Skeleton className="h-64 rounded-xl sm:col-span-3" />
        </div>
      ) : rows.length ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon="ph:buildings-duotone" label="Total tenants" value={rows.length} />
            <StatCard
              icon="ph:check-circle-duotone"
              label="Active (by status)"
              value={activeLike}
              hint="Exact status match ACTIVE"
            />
            <StatCard
              icon="ph:folders-duotone"
              label="With slug"
              value={rows.filter((r) => Boolean(r.slug)).length}
            />
          </div>
          <Card className="overflow-hidden border-smoke-400/10 bg-white/90 shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_40px_-28px_rgba(15,23,42,0.12)]">
            <CardHeader className="border-b border-smoke-400/[0.07] bg-ivory-50/80 pb-4">
              <CardTitle className="text-base font-semibold text-smoke-400">All tenants</CardTitle>
              <p className="text-sm font-normal text-smoke-200">Sortable directory — click a name for full detail.</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <thead>
                    <tr className="bg-smoke-400/[0.03]">
                      <Th>Name</Th>
                      <Th>Status</Th>
                      <Th>Slug</Th>
                      <Th>Created</Th>
                      <Th>Tenant ID</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-ivory-50/90">
                        <Td className="font-medium text-smoke-400">
                          <Link
                            href={`/admin/tenants/${encodeURIComponent(r.id)}`}
                            className="font-semibold text-violet-800 underline-offset-4 hover:underline"
                          >
                            {r.name ?? '—'}
                          </Link>
                        </Td>
                        <Td>
                          {r.status ? (
                            <StatusChip status={r.status} />
                          ) : (
                            <span className="text-sm text-smoke-200">—</span>
                          )}
                        </Td>
                        <Td className="text-sm text-smoke-300">{r.slug ?? '—'}</Td>
                        <Td className="whitespace-nowrap text-xs text-smoke-200">
                          {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                        </Td>
                        <Td className="text-xs text-smoke-200" title={r.id}>
                          <Link
                            href={`/admin/tenants/${encodeURIComponent(r.id)}`}
                            className="font-medium text-smoke-300 underline-offset-4 hover:underline"
                          >
                            {shortenId(r.id)}
                          </Link>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          variant="premium"
          icon="ph:buildings-duotone"
          title="No tenants visible"
          description="Sign in as SUPER_ADMIN to list platform tenants, or verify your role assignments."
        />
      )}
    </div>
  );
}
