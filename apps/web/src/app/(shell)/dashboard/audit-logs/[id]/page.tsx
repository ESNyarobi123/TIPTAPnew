'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusChip } from '@/components/ui/status-chip';
import { StructuredObject } from '@/components/ui/structured-object';
import { ApiError } from '@/lib/api/client';
import { getAuditLog } from '@/lib/api/audit-logs';
import { getStoredToken } from '@/lib/auth/storage';

export default function AuditLogDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token || !id) {
      setLoading(false);
      return;
    }
    getAuditLog(token, id)
      .then((r) => setRow(r as Record<string, unknown>))
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Not found'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="space-y-8">
      <SectionHeader
        tone="business"
        eyebrow="Immutable event"
        title="Audit entry"
        description="Structured payload for compliance review. Data is read-only from the API."
        action={
          <Link
            href="/dashboard/audit-logs"
            className="rounded-xl border border-smoke-400/12 bg-ivory-50 px-4 py-2 text-sm font-medium text-smoke-400 shadow-soft transition hover:border-smoke-400/20"
          >
            ← Back to list
          </Link>
        }
      />

      {loading ? <p className="text-sm text-smoke-200">Loading…</p> : null}
      {err ? (
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-5 py-4 text-sm text-rose-900">{err}</div>
      ) : null}

      {row ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="grid gap-6 lg:grid-cols-3"
        >
          <Card className="overflow-hidden border-smoke-400/10 lg:col-span-2">
            <CardHeader className="border-b border-smoke-400/6 bg-smoke-400/[0.02]">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <StatusChip status={String(row.action ?? '—')} />
                <span className="text-smoke-200">{String(row.entityType ?? '')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6 text-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Summary</p>
                <p className="mt-1.5 text-smoke-400">{String(row.summary ?? '—')}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Details</p>
                <div className="mt-3 max-h-[420px] overflow-auto rounded-xl border border-smoke-400/[0.08] bg-ivory-50/90 p-4">
                  <StructuredObject value={row.details ?? {}} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-smoke-400/10">
            <CardHeader>
              <CardTitle className="text-base">Correlation</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4 text-sm">
                {[
                  ['id', row.id],
                  ['tenantId', row.tenantId],
                  ['branchId', row.branchId],
                  ['actorUserId', row.actorUserId],
                  ['correlationId', row.correlationId],
                  ['createdAt', row.createdAt],
                ].map(([k, v]) => (
                  <div key={String(k)}>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-smoke-200">{String(k)}</dt>
                    <dd className="mt-1 break-all font-mono text-xs text-smoke-300">{String(v ?? '—')}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}
    </div>
  );
}
