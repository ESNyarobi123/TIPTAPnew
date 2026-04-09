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
import { toast } from '@/lib/toast';

export default function ProviderRatingsPage() {
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
        toast.error('Could not load ratings');
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
        icon="fluent-color:person-feedback-48"
        title="No linked feedback yet"
        description="Ratings will show after your business link is active and guests leave feedback."
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-900/60">Feedback</p>
        <h1 className="mt-2 font-display text-[1.9rem] font-semibold tracking-tight text-smoke-400">Ratings</h1>
        <p className="mt-2 text-sm text-smoke-200">Your linked scores and recent guest comments.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-smoke-400/10 bg-ivory-50/92">
          <CardContent className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Average</p>
            <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">
              {workspace.summary.ratingAverage != null ? workspace.summary.ratingAverage.toFixed(2) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-smoke-400/10 bg-ivory-50/92">
          <CardContent className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Feedback rows</p>
            <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">{workspace.summary.ratingCount}</p>
          </CardContent>
        </Card>
        <Card className="border-smoke-400/10 bg-ivory-50/92">
          <CardContent className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Linked businesses</p>
            <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">{workspace.summary.linkedBusinesses}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        {workspace.recentRatings.length ? (
          workspace.recentRatings.map((rating) => (
            <Card key={rating.id} className="border-smoke-400/10 bg-white/72">
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-smoke-400">
                      {rating.staffName ?? 'Staff'}
                      {rating.branchName ? ` · ${rating.branchName}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-smoke-200">
                      {rating.vertical?.replaceAll('_', ' ') ?? 'Service'} · {new Date(rating.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon icon="fluent-color:person-feedback-48" className="h-8 w-8" aria-hidden />
                    <p className="font-display text-xl font-semibold text-smoke-400">
                      {rating.score}/{rating.maxScore}
                    </p>
                  </div>
                </div>
                {rating.comment ? <p className="text-sm text-smoke-300">{rating.comment}</p> : null}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border-smoke-400/10 bg-white/72">
            <CardContent className="p-6 text-sm text-smoke-200">No feedback rows yet.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
