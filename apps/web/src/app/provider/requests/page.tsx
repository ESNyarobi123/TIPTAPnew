'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { StatusChip } from '@/components/ui/status-chip';
import { Table, Td, Th } from '@/components/ui/table';
import { TabList } from '@/components/ui/tabs';
import { ApiError } from '@/lib/api/client';
import { getProviderWorkspace, type ProviderWorkspace } from '@/lib/api/provider-workspace';
import { getStoredToken } from '@/lib/auth/storage';
import { formatMinorUnits } from '@/lib/format';
import { toast } from '@/lib/toast';

function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function ProviderRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<ProviderWorkspace | null>(null);
  const [tab, setTab] = useState<'requests' | 'tasks'>('requests');

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getProviderWorkspace(token)
      .then((payload) => {
        setWorkspace(payload);
        if ((payload.desk?.requestQueue?.length ?? 0) === 0 && (payload.desk?.taskQueue?.length ?? 0) > 0) {
          setTab('tasks');
        }
      })
      .catch((error) => {
        toast.error(error instanceof ApiError ? error.message : 'Could not load request desk');
        setWorkspace(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const requests = workspace?.desk?.requestQueue ?? [];
  const tasks = workspace?.desk?.taskQueue ?? [];
  const activeAssignments = workspace?.summary.activeAssignments ?? 0;
  const linkedBusinesses = workspace?.summary.linkedBusinesses ?? 0;
  const pendingPay = workspace?.summary.scheduledCompensationCents ?? 0;
  const ratingCount = workspace?.summary.ratingCount ?? 0;

  const nextTask = useMemo(() => tasks[0] ?? null, [tasks]);

  if (!getStoredToken()) {
    return (
      <EmptyState
        variant="premium"
        icon="ph:lock-key-duotone"
        title="Sign in required"
        description="Sign in to open your request desk."
        action={
          <Button asChild className="shadow-soft">
            <Link href="/login">Sign in</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="My work" title="Request desk" description="Your assigned requests and live service lane." />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon="fluent-color:chat-help-24" label="Open requests" value={requests.length} hint="Directly assigned" />
          <StatCard icon="fluent-color:calendar-agenda-24" label="Active tasks" value={tasks.length} hint={nextTask ? nextTask.reference : 'No active task'} />
          <StatCard icon="fluent-color:building-people-24" label="Assignments" value={activeAssignments} hint={`${linkedBusinesses} linked businesses`} />
          <StatCard icon="fluent-color:wallet-credit-card-16" label="Pending pay" value={formatMinorUnits(pendingPay)} hint={`${ratingCount} rating rows`} />
        </div>
      )}

      {!loading && workspace && !workspace.links.length ? (
        <EmptyState
          variant="premium"
          icon="fluent-color:contact-card-48"
          title="No business link yet"
          description="Give your TIPTAP code to a manager so requests and tasks can route here."
          action={
            <Button asChild className="shadow-soft">
              <Link href="/provider/profile">Open profile</Link>
            </Button>
          }
        />
      ) : null}

      {!loading && workspace?.links.length ? (
        <Card className="border-smoke-400/10 shadow-card">
          <CardHeader className="border-b border-smoke-400/[0.06]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Desk</CardTitle>
              <TabList
                tabs={[
                  { id: 'requests', label: `Requests (${requests.length})` },
                  { id: 'tasks', label: `Service lane (${tasks.length})` },
                ]}
                value={tab}
                onChange={(value) => setTab(value as 'requests' | 'tasks')}
                className="w-full sm:w-auto"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {tab === 'requests' ? (
              requests.length ? (
                <Table>
                  <thead>
                    <tr>
                      <Th>Type</Th>
                      <Th>Business</Th>
                      <Th>Location</Th>
                      <Th>Status</Th>
                      <Th>Created</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((row) => (
                      <tr key={row.id}>
                        <Td>
                          <div className="font-medium text-smoke-400">
                            {row.kind === 'WAITER_CALL' ? 'Waiter call' : 'Assistance'}
                          </div>
                          <div className="text-xs text-smoke-200">{row.notes?.trim() ? row.notes : row.vertical.replaceAll('_', ' ')}</div>
                        </Td>
                        <Td>
                          <div className="font-medium text-smoke-400">{row.tenantName}</div>
                          <div className="text-xs text-smoke-200">{row.branchName}</div>
                        </Td>
                        <Td className="text-sm text-smoke-200">{row.locationLabel ?? 'No spot set'}</Td>
                        <Td><StatusChip status={row.status} /></Td>
                        <Td className="text-xs text-smoke-200">{formatWhen(row.createdAt)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <EmptyState
                  icon="fluent-color:chat-help-24"
                  title="No assigned requests"
                  description="When a manager or customer routes a request to you, it will appear here."
                />
              )
            ) : tasks.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>Lane</Th>
                    <Th>Reference</Th>
                    <Th>Guest</Th>
                    <Th>Status</Th>
                    <Th>Amount</Th>
                    <Th>When</Th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((row) => (
                    <tr key={row.id}>
                      <Td>
                        <div className="font-medium text-smoke-400">
                          {row.kind === 'DINING_ORDER' ? 'Dining order' : 'Beauty booking'}
                        </div>
                        <div className="text-xs text-smoke-200">{row.branchName}</div>
                      </Td>
                      <Td>
                        <div className="font-medium text-smoke-400">{row.reference}</div>
                        <div className="text-xs text-smoke-200">{row.locationLabel ?? 'Floor / station'}</div>
                      </Td>
                      <Td className="text-sm text-smoke-200">
                        {row.customerLabel ?? 'Guest in venue'}
                        {row.serviceSummary?.length ? (
                          <span className="mt-1 block text-xs text-smoke-200">{row.serviceSummary.join(', ')}</span>
                        ) : null}
                      </Td>
                      <Td><StatusChip status={row.status} /></Td>
                      <Td className="font-medium">
                        {row.amountCents != null ? formatMinorUnits(row.amountCents, row.currency ?? 'TZS') : '—'}
                      </Td>
                      <Td className="text-xs text-smoke-200">{formatWhen(row.scheduledAt ?? row.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState
                icon="fluent-color:calendar-agenda-24"
                title="No live service lane"
                description="Assigned orders and bookings will show here."
              />
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
