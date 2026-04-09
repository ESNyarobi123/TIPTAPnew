'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { getProviderWorkspace, type ProviderWorkspace } from '@/lib/api/provider-workspace';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';

export default function ProviderAssignmentsPage() {
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
        toast.error('Could not load assignments');
        setWorkspace(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-40 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!workspace?.links?.length) {
    return (
      <EmptyState
        variant="premium"
        icon="fluent-color:building-people-24"
        title="No business link yet"
        description="Once a manager links you, your active business and branch will show here."
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
        <h1 className="mt-2 font-display text-[1.9rem] font-semibold tracking-tight text-smoke-400">Assignments</h1>
        <p className="mt-2 text-sm text-smoke-200">Current business links and active branch assignments.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {workspace.links.map((link) => (
          <Card key={link.staffId} className="h-full border-smoke-400/10 bg-ivory-50/92 shadow-soft">
            <CardHeader className="border-b border-smoke-400/[0.06]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">
                    {link.categories[0]?.replaceAll('_', ' ') ?? 'Service'}
                  </p>
                  <CardTitle className="mt-3 text-xl">{link.tenantName ?? 'Business'}</CardTitle>
                  <p className="mt-1 text-sm text-smoke-200">{link.branchName ?? 'No branch pinned'}</p>
                </div>
                <Icon icon="fluent-color:building-people-24" className="h-10 w-10 shrink-0" aria-hidden />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <div className="rounded-[1.15rem] border border-smoke-400/[0.06] bg-white/70 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Role</p>
                  <p className="mt-1 text-sm font-semibold text-smoke-400">{link.roleInTenant.replaceAll('_', ' ')}</p>
                </div>
                <div className="rounded-[1.15rem] border border-smoke-400/[0.06] bg-white/70 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Assignments</p>
                  <div className="mt-2 space-y-2">
                    {link.activeAssignments.length ? (
                      link.activeAssignments.map((assignment) => (
                        <div key={assignment.id} className="rounded-xl border border-smoke-400/[0.06] bg-ivory-50/90 px-3 py-2">
                          <p className="text-sm font-semibold text-smoke-400">{assignment.branchName ?? 'Branch'}</p>
                          <p className="mt-1 text-xs text-smoke-200">
                            {assignment.mode.replaceAll('_', ' ')} · {new Date(assignment.startedAt).toLocaleDateString()}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-smoke-200">No active branch assignment.</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
