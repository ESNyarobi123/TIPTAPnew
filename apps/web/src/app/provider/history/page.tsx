'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, Td, Th } from '@/components/ui/table';
import { getProviderWorkspace, type ProviderWorkspace } from '@/lib/api/provider-workspace';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';

function formatRange(startedAt: string, endedAt?: string | null) {
  try {
    const s = new Date(startedAt).toLocaleDateString(undefined, { dateStyle: 'medium' });
    if (!endedAt) return `${s} → now`;
    const e = new Date(endedAt).toLocaleDateString(undefined, { dateStyle: 'medium' });
    return `${s} → ${e}`;
  } catch {
    return startedAt;
  }
}

export default function ProviderHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<ProviderWorkspace | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getProviderWorkspace(token)
      .then((payload) => setWorkspace(payload))
      .catch(() => {
        toast.error('Could not load work history');
        setWorkspace(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-2/3 max-w-md rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!workspace?.links?.length) {
    return (
      <EmptyState
        variant="premium"
        icon="fluent-color:history-24"
        title="No work history yet"
        description="When a business links your profile, your current branch and past assignments will show here."
        action={
          <Button asChild className="rounded-full shadow-soft">
            <Link href="/provider/profile">Open profile</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-900/60">My work</p>
        <h1 className="mt-2 font-display text-[1.9rem] font-semibold tracking-tight text-smoke-400">History</h1>
        <p className="mt-2 text-sm text-smoke-200">
          Where you are working now, and branches you were assigned to before.
        </p>
      </div>

      <div className="grid gap-6">
        {workspace.links.map((link) => {
          const history = link.assignmentHistory ?? [];
          const active = link.activeAssignments ?? [];
          const homeBranch = link.branchName;

          return (
            <Card key={link.staffId} className="border-smoke-400/10 bg-ivory-50/92 shadow-soft">
              <CardHeader className="border-b border-smoke-400/[0.06]">
                <CardTitle className="text-lg">{link.tenantName ?? 'Business'}</CardTitle>
                <p className="text-sm text-smoke-200">
                  {link.categories[0]?.replaceAll('_', ' ') ?? 'Service'} ·{' '}
                  {link.roleInTenant.replaceAll('_', ' ')}
                </p>
              </CardHeader>
              <CardContent className="space-y-6 pt-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-900/55">
                    Current
                  </p>
                  <div className="mt-3 rounded-[1.15rem] border border-teal-900/12 bg-teal-50/50 p-4">
                    <p className="text-sm font-semibold text-smoke-400">Home branch (staff record)</p>
                    <p className="mt-1 text-sm text-smoke-200">{homeBranch ?? 'Not pinned to a branch'}</p>
                    {active.length ? (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-semibold text-smoke-300">Active branch assignments</p>
                        <ul className="space-y-2">
                          {active.map((a) => (
                            <li
                              key={a.id}
                              className="rounded-xl border border-smoke-400/[0.08] bg-white/80 px-3 py-2 text-sm"
                            >
                              <span className="font-semibold text-smoke-400">{a.branchName ?? 'Branch'}</span>
                              <span className="mt-0.5 block text-xs text-smoke-200">
                                {a.mode.replaceAll('_', ' ')} · since{' '}
                                {new Date(a.startedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-smoke-200">No active multi-branch assignment on file.</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Past</p>
                  {history.length === 0 ? (
                    <p className="mt-3 text-sm text-smoke-200">No ended branch assignments recorded yet.</p>
                  ) : (
                    <Table className="mt-3">
                      <thead>
                        <tr>
                          <Th>Branch</Th>
                          <Th>Mode</Th>
                          <Th>Period</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((a) => (
                          <tr key={a.id}>
                            <Td className="font-medium text-smoke-400">{a.branchName ?? '—'}</Td>
                            <Td className="text-sm text-smoke-200">{a.mode.replaceAll('_', ' ')}</Td>
                            <Td className="text-sm text-smoke-200">{formatRange(a.startedAt, a.endedAt)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
