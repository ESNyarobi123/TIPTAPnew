'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { Select } from '@/components/ui/select';
import { Table, Td, Th } from '@/components/ui/table';
import { ApiError } from '@/lib/api/client';
import { listRatings, type RatingTargetTypeFilter } from '@/lib/api/ratings';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

type RatingRow = {
  id: string;
  score?: number;
  maxScore?: number;
  targetType?: string;
  targetId?: string;
  comment?: string | null;
  sessionId?: string | null;
  vertical?: string | null;
  branchId?: string | null;
  createdAt?: string | null;
};

function asRating(x: unknown): RatingRow | null {
  const o = (x ?? {}) as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : '';
  if (!id) return null;
  return {
    id,
    score: typeof o.score === 'number' ? o.score : undefined,
    maxScore: typeof o.maxScore === 'number' ? o.maxScore : undefined,
    targetType: typeof o.targetType === 'string' ? o.targetType : undefined,
    targetId: typeof o.targetId === 'string' ? o.targetId : undefined,
    comment: typeof o.comment === 'string' ? o.comment : (o.comment === null ? null : undefined),
    sessionId: typeof o.sessionId === 'string' ? o.sessionId : (o.sessionId === null ? null : undefined),
    vertical: typeof o.vertical === 'string' ? o.vertical : (o.vertical === null ? null : undefined),
    branchId: typeof o.branchId === 'string' ? o.branchId : (o.branchId === null ? null : undefined),
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : (o.createdAt === null ? null : undefined),
  };
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function FeedbackRatingsPage() {
  const { tenantId } = useScope();
  const [rows, setRows] = useState<RatingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetType, setTargetType] = useState<RatingTargetTypeFilter | ''>('');

  async function refresh() {
    const token = getStoredToken();
    if (!token || !tenantId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const raw = await listRatings(token, {
        tenantId,
        ...(targetType ? { targetType } : {}),
      });
      const list = (Array.isArray(raw) ? raw : []).map(asRating).filter((r): r is RatingRow => r != null);
      setRows(list);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not load ratings');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, targetType]);

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Guest channels"
        title="Feedback & Ratings"
        description="Scores and comments submitted from WhatsApp (and other) bot sessions. Each row may link to a conversation session."
      />

      {!tenantId ? (
        <EmptyState
          icon="fluent-color:person-feedback-48"
          title="Select a tenant"
          description="Choose a tenant in the top bar to load feedback."
        />
      ) : null}

      {tenantId ? (
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <CardTitle className="text-base">Filters</CardTitle>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="fb-target">Target type</Label>
                <Select
                  id="fb-target"
                  value={targetType}
                  onChange={(e) => setTargetType((e.target.value || '') as RatingTargetTypeFilter | '')}
                >
                  <option value="">All targets</option>
                  <option value="BUSINESS">BUSINESS</option>
                  <option value="STAFF">STAFF</option>
                  <option value="SERVICE">SERVICE</option>
                  <option value="PROVIDER_EXPERIENCE">PROVIDER_EXPERIENCE</option>
                </Select>
              </div>
              <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading}>
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-smoke-200">Loading…</p>
            ) : rows.length === 0 ? (
              <EmptyState
                icon="fluent-color:chat-sparkle-48"
                title="No feedback yet"
                description="When guests complete in-chat ratings on WhatsApp, entries appear here."
                action={
                  <Button asChild variant="outline">
                    <Link href="/dashboard/conversations">Open WhatsApp inbox</Link>
                  </Button>
                }
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Score</Th>
                    <Th>Target</Th>
                    <Th>Comment</Th>
                    <Th>Session</Th>
                    <Th>Vertical</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <Td className="whitespace-nowrap text-sm">{formatWhen(r.createdAt)}</Td>
                      <Td className="font-medium">
                        {r.score != null ? `${r.score}${r.maxScore != null ? ` / ${r.maxScore}` : ''}` : '—'}
                      </Td>
                      <Td className="font-mono text-xs">
                        {r.targetType ?? '—'}
                        {r.targetId ? (
                          <span className="block truncate text-smoke-200" title={r.targetId}>
                            {r.targetId.slice(0, 12)}…
                          </span>
                        ) : null}
                      </Td>
                      <Td className="max-w-[min(28rem,55vw)] text-sm text-smoke-200">
                        {r.comment?.trim() ? r.comment : '—'}
                      </Td>
                      <Td className="font-mono text-xs">
                        {r.sessionId ? (
                          <Link
                            href={`/dashboard/conversations?sessionId=${encodeURIComponent(r.sessionId)}`}
                            className="text-teal-700 underline decoration-teal-700/30 hover:decoration-teal-700"
                            title={r.sessionId}
                          >
                            {r.sessionId.slice(0, 10)}…
                          </Link>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td className="text-xs">{r.vertical ?? '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
