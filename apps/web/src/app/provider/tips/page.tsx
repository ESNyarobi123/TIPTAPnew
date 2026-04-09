'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { getProviderWorkspace, type ProviderWorkspace } from '@/lib/api/provider-workspace';
import { getStoredToken } from '@/lib/auth/storage';
import { formatMinorUnits } from '@/lib/format';
import { toast } from '@/lib/toast';

export default function ProviderTipsPage() {
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
        toast.error('Could not load tips');
        setWorkspace(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!workspace?.links?.length) {
    return (
      <EmptyState
        variant="premium"
        icon="fluent-color:coin-multiple-48"
        title="No linked tips yet"
        description="Tips will appear after your business link is active and guest tips are attributed to you."
        action={
          <Button asChild className="rounded-full shadow-soft">
            <Link href="/provider/assignments">Open assignments</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-900/60">Earnings</p>
        <h1 className="mt-2 font-display text-[1.9rem] font-semibold tracking-tight text-smoke-400">Tips</h1>
        <p className="mt-2 text-sm text-smoke-200">Your linked tip totals and latest tip activity.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-smoke-400/10 bg-ivory-50/92">
          <CardContent className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Total tips</p>
            <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">
              {formatMinorUnits(workspace.summary.totalTipsCents)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-smoke-400/10 bg-ivory-50/92">
          <CardContent className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Tip rows</p>
            <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">{workspace.summary.totalTipsCount}</p>
          </CardContent>
        </Card>
        <Card className="border-smoke-400/10 bg-ivory-50/92">
          <CardContent className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Pending</p>
            <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">
              {workspace.links.reduce((sum, link) => sum + link.tipSummary.pendingCount, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        {workspace.recentTips.length ? (
          workspace.recentTips.map((tip) => (
            <Card key={tip.id} className="border-smoke-400/10 bg-white/72">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-smoke-400">
                    {tip.staffName}
                    {tip.branchName ? ` · ${tip.branchName}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-smoke-200">
                    {tip.mode} · {tip.status} · {new Date(tip.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Icon icon="fluent-color:coin-multiple-48" className="h-8 w-8" aria-hidden />
                  <p className="font-display text-xl font-semibold text-smoke-400">
                    {formatMinorUnits(tip.amountCents)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border-smoke-400/10 bg-white/72">
            <CardContent className="p-6 text-sm text-smoke-200">No tip rows yet.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
