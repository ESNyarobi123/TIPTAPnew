'use client';

import Link from 'next/link';
import { Suspense, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { KeyValueList } from '@/components/ui/key-value-list';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusChip } from '@/components/ui/status-chip';
import { StructuredObject } from '@/components/ui/structured-object';
import { Table, Td, Th } from '@/components/ui/table';
import { ApiError } from '@/lib/api/client';
import {
  getConversationMessages,
  getConversationSession,
  listConversationSessions,
} from '@/lib/api/conversations';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

type SessionRow = {
  id: string;
  channel?: string;
  currentState?: string;
  externalCustomerId?: string | null;
  branchId?: string | null;
  staffId?: string | null;
  diningTableId?: string | null;
  beautyStationId?: string | null;
  lastActivityAt?: string | null;
  expiresAt?: string | null;
  language?: string | null;
  metadata?: unknown;
  qrContext?: unknown;
};

type MessageRow = {
  id: string;
  direction?: string;
  body?: string;
  payload?: unknown;
  createdAt?: string | null;
};

function asSessionRow(x: unknown): SessionRow | null {
  const o = (x ?? {}) as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : '';
  if (!id) return null;
  return {
    id,
    channel: typeof o.channel === 'string' ? o.channel : undefined,
    currentState: typeof o.currentState === 'string' ? o.currentState : undefined,
    externalCustomerId:
      typeof o.externalCustomerId === 'string'
        ? o.externalCustomerId
        : (o.externalCustomerId === null ? null : undefined),
    branchId: typeof o.branchId === 'string' ? o.branchId : (o.branchId === null ? null : undefined),
    staffId: typeof o.staffId === 'string' ? o.staffId : (o.staffId === null ? null : undefined),
    diningTableId:
      typeof o.diningTableId === 'string' ? o.diningTableId : (o.diningTableId === null ? null : undefined),
    beautyStationId:
      typeof o.beautyStationId === 'string' ? o.beautyStationId : (o.beautyStationId === null ? null : undefined),
    lastActivityAt:
      typeof o.lastActivityAt === 'string' ? o.lastActivityAt : (o.lastActivityAt === null ? null : undefined),
    expiresAt: typeof o.expiresAt === 'string' ? o.expiresAt : (o.expiresAt === null ? null : undefined),
    language: typeof o.language === 'string' ? o.language : (o.language === null ? null : undefined),
    metadata: o.metadata,
    qrContext: o.qrContext,
  };
}

function asMessageRow(x: unknown): MessageRow | null {
  const o = (x ?? {}) as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : '';
  if (!id) return null;
  return {
    id,
    direction: typeof o.direction === 'string' ? o.direction : undefined,
    body: typeof o.body === 'string' ? o.body : undefined,
    payload: o.payload,
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : (o.createdAt === null ? null : undefined),
  };
}

function asList(x: unknown): { items: SessionRow[]; total: number } {
  const o = (x ?? {}) as Record<string, unknown>;
  const itemsRaw = Array.isArray(o.items) ? o.items : [];
  const items = itemsRaw.map(asSessionRow).filter((item): item is SessionRow => Boolean(item));
  const total = typeof o.total === 'number' ? o.total : items.length;
  return { items, total };
}

function shortId(value?: string | null) {
  if (!value) return '—';
  return value.length > 10 ? `${value.slice(0, 8)}…` : value;
}

function ConversationsPageInner() {
  const searchParams = useSearchParams();
  const urlSessionId = searchParams.get('sessionId');
  const { tenantId, loading: scopeLoading } = useScope();
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [q, setQ] = useState('');
  const [data, setData] = useState<{ items: SessionRow[]; total: number }>({ items: [], total: 0 });
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token || scopeLoading || !tenantId) {
      setLoading(false);
      setData({ items: [], total: 0 });
      setSelectedSessionId(null);
      setSelectedSession(null);
      setMessages([]);
      return;
    }
    setLoading(true);
    listConversationSessions(token, { tenantId, page: 1, pageSize: 50 })
      .then((r) => {
        const next = asList(r);
        setData(next);
        setSelectedSessionId((current) => {
          if (urlSessionId) {
            return urlSessionId;
          }
          return current ?? next.items[0]?.id ?? null;
        });
      })
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load sessions'))
      .finally(() => setLoading(false));
  }, [tenantId, scopeLoading, urlSessionId]);

  const deferredQ = useDeferredValue(q.trim().toLowerCase());
  const filtered = useMemo(() => {
    if (!deferredQ) return data.items;
    return data.items.filter((s) => {
      const hay = [
        s.id,
        s.channel,
        s.currentState,
        s.externalCustomerId,
        s.branchId,
        s.staffId,
        s.diningTableId,
        s.beautyStationId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(deferredQ);
    });
  }, [data.items, deferredQ]);

  useEffect(() => {
    if (selectedSessionId && filtered.some((item) => item.id === selectedSessionId)) {
      return;
    }
    if (urlSessionId && selectedSessionId === urlSessionId) {
      return;
    }
    if (filtered.length) {
      setSelectedSessionId(filtered[0].id);
    } else {
      setSelectedSessionId(null);
      setSelectedSession(null);
      setMessages([]);
    }
  }, [filtered, selectedSessionId, urlSessionId]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token || !selectedSessionId) {
      setSelectedSession(null);
      setMessages([]);
      return;
    }
    setDetailLoading(true);
    Promise.all([
      getConversationSession(token, selectedSessionId),
      getConversationMessages(token, selectedSessionId),
    ])
      .then(([sessionRes, messageRes]) => {
        setSelectedSession(asSessionRow(sessionRes));
        setMessages(
          (Array.isArray(messageRes) ? messageRes : [])
            .map(asMessageRow)
            .filter((item): item is MessageRow => Boolean(item)),
        );
      })
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load session detail'))
      .finally(() => setDetailLoading(false));
  }, [selectedSessionId]);

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="business"
        eyebrow="Guest interactions"
        title="WhatsApp sessions"
        description="Operational view of guest conversations with live context, timeline, and transcript for each QR-grounded session."
      />

      {!tenantId && !scopeLoading ? (
        <EmptyState
          variant="premium"
          icon="ph:buildings-duotone"
          title="Select a tenant"
          description="Choose an organization in the header to view its WhatsApp sessions."
        />
      ) : loading ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <Skeleton className="h-[28rem] rounded-2xl" />
          <Skeleton className="h-[28rem] rounded-2xl" />
        </div>
      ) : (
        <>
          <FilterBar>
            <div className="space-y-1">
              <Label htmlFor="conv-q">Search</Label>
              <Input
                id="conv-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="session id, customer id, state…"
                className="h-10 min-w-[16rem]"
              />
            </div>
            <div className="ml-auto text-sm text-smoke-200">
              Total: <span className="font-medium text-smoke-400">{data.total}</span>
            </div>
          </FilterBar>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
            <Card className="border-smoke-400/10 shadow-card">
              <CardHeader className="border-b border-smoke-400/[0.06]">
                <CardTitle className="text-base">Recent sessions</CardTitle>
                {urlSessionId &&
                selectedSessionId === urlSessionId &&
                !data.items.some((s) => s.id === urlSessionId) ? (
                  <p className="mt-2 text-xs text-smoke-200">
                    Opened from link — this session is not in the latest page of results; detail loads on the
                    right.
                  </p>
                ) : null}
              </CardHeader>
              <CardContent className="pt-5">
                {filtered.length === 0 ? (
                  <EmptyState
                    variant="premium"
                    icon="logos:whatsapp-icon"
                    title="No sessions in this view"
                    description="Once guests scan a QR and message the bot, sessions will appear here."
                  />
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <Th>Channel</Th>
                        <Th>State</Th>
                        <Th>Customer</Th>
                        <Th>Context</Th>
                        <Th>Last activity</Th>
                        <Th />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s) => {
                        const active = s.id === selectedSessionId;
                        return (
                          <tr key={s.id} className={active ? 'bg-teal-50/35' : undefined}>
                            <Td className="text-xs text-smoke-200">{String(s.channel ?? '—')}</Td>
                            <Td>
                              <StatusChip status={String(s.currentState ?? '—')} />
                            </Td>
                            <Td className="max-w-[220px] truncate text-xs text-smoke-200">
                              {String(s.externalCustomerId ?? '—')}
                            </Td>
                            <Td className="text-xs text-smoke-200">
                              {s.staffId
                                ? `Staff ${shortId(s.staffId)}`
                                : s.diningTableId
                                  ? `Table ${shortId(s.diningTableId)}`
                                  : s.beautyStationId
                                    ? `Station ${shortId(s.beautyStationId)}`
                                    : s.branchId
                                      ? `Branch ${shortId(s.branchId)}`
                                      : 'Business entry'}
                            </Td>
                            <Td className="text-xs text-smoke-200">
                              {s.lastActivityAt ? new Date(s.lastActivityAt).toLocaleString() : '—'}
                            </Td>
                            <Td className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button type="button" size="sm" variant={active ? 'primary' : 'outline'} onClick={() => setSelectedSessionId(s.id)}>
                                  {active ? 'Open' : 'View'}
                                </Button>
                                <Link
                                  href={`/dashboard/audit-logs?sessionId=${encodeURIComponent(String(s.id))}`}
                                  className="inline-flex items-center text-xs font-medium text-violet-900 hover:underline"
                                >
                                  Logs
                                </Link>
                              </div>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="border-smoke-400/10 shadow-card">
              <CardHeader className="border-b border-smoke-400/[0.06]">
                <CardTitle className="text-base">Session detail</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                {detailLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-28 rounded-2xl" />
                    <Skeleton className="h-64 rounded-2xl" />
                  </div>
                ) : !selectedSession ? (
                  <EmptyState
                    variant="premium"
                    icon="ph:chat-circle-text-duotone"
                    title="Select a session"
                    description="Pick a session from the left side to inspect the live context and transcript."
                  />
                ) : (
                  <>
                    <KeyValueList
                      rows={[
                        { label: 'Session', value: selectedSession.id },
                        { label: 'State', value: <StatusChip status={selectedSession.currentState ?? '—'} /> },
                        { label: 'Channel', value: selectedSession.channel ?? '—' },
                        { label: 'Language', value: selectedSession.language ?? '—' },
                        { label: 'Customer', value: selectedSession.externalCustomerId ?? '—' },
                        { label: 'Branch', value: selectedSession.branchId ?? '—' },
                        { label: 'Staff', value: selectedSession.staffId ?? '—' },
                        { label: 'Table', value: selectedSession.diningTableId ?? '—' },
                        { label: 'Station', value: selectedSession.beautyStationId ?? '—' },
                        {
                          label: 'Last activity',
                          value: selectedSession.lastActivityAt
                            ? new Date(selectedSession.lastActivityAt).toLocaleString()
                            : '—',
                        },
                        {
                          label: 'Expires',
                          value: selectedSession.expiresAt ? new Date(selectedSession.expiresAt).toLocaleString() : '—',
                        },
                      ]}
                    />

                    <div className="space-y-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Session metadata</p>
                        <div className="mt-2">
                          <StructuredObject value={selectedSession.metadata} />
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">QR context</p>
                        <div className="mt-2">
                          <StructuredObject value={selectedSession.qrContext} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Transcript</p>
                        <p className="text-xs text-smoke-200">{messages.length} message(s)</p>
                      </div>
                      {messages.length ? (
                        <div className="max-h-[32rem] space-y-3 overflow-auto rounded-2xl border border-smoke-400/[0.06] bg-ivory-50/75 p-3">
                          {messages.map((message) => {
                            const outbound = message.direction === 'OUTBOUND';
                            return (
                              <div
                                key={message.id}
                                className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}
                              >
                                <div
                                  className={`max-w-[88%] rounded-2xl px-3 py-2.5 shadow-soft ${
                                    outbound
                                      ? 'bg-smoke-400 text-ivory-100'
                                      : 'border border-smoke-400/[0.06] bg-white text-smoke-400'
                                  }`}
                                >
                                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${outbound ? 'text-ivory-100/70' : 'text-smoke-200'}`}>
                                    {message.direction ?? 'MESSAGE'}
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                                    {message.body ?? '—'}
                                  </p>
                                  {message.payload ? (
                                    <div className={`mt-2 rounded-xl p-2 ${outbound ? 'bg-white/10' : 'bg-ivory-100/70'}`}>
                                      <StructuredObject value={message.payload} />
                                    </div>
                                  ) : null}
                                  <p className={`mt-2 text-[10px] ${outbound ? 'text-ivory-100/70' : 'text-smoke-200'}`}>
                                    {message.createdAt ? new Date(message.createdAt).toLocaleString() : '—'}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <EmptyState
                          variant="premium"
                          icon="ph:chat-circle-text-duotone"
                          title="No messages recorded"
                          description="This session exists, but no transcript rows are visible yet."
                        />
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-8 md:space-y-10">
          <SectionHeader eyebrow="Guest channels" title="WhatsApp inbox" description="Loading…" />
          <p className="text-sm text-smoke-200">Loading…</p>
        </div>
      }
    >
      <ConversationsPageInner />
    </Suspense>
  );
}
