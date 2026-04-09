'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { Select } from '@/components/ui/select';
import { Table, Td, Th } from '@/components/ui/table';
import { ApiError } from '@/lib/api/client';
import { listAssistanceRequests, patchAssistanceRequest } from '@/lib/api/beauty-grooming';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

type ReqRow = { id: string; status?: string; stationId?: string | null; staffId?: string | null; createdAt?: string; notes?: string | null };

function asReq(x: unknown): ReqRow {
  const o = (x ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    status: typeof o.status === 'string' ? o.status : undefined,
    stationId: typeof o.stationId === 'string' ? o.stationId : (o.stationId === null ? null : undefined),
    staffId: typeof o.staffId === 'string' ? o.staffId : (o.staffId === null ? null : undefined),
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : undefined,
    notes: typeof o.notes === 'string' ? o.notes : (o.notes === null ? null : undefined),
  };
}

const statuses = ['', 'PENDING', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED'] as const;

export default function BeautyOpsPage() {
  const { tenantId, branchId } = useScope();
  const [rows, setRows] = useState<ReqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [filterStatus, setFilterStatus] = useState<(typeof statuses)[number]>('');

  async function refresh() {
    const token = getStoredToken();
    if (!token || !tenantId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await listAssistanceRequests(token, { tenantId, branchId: branchId ?? null, status: filterStatus || null });
      setRows((Array.isArray(list) ? list : []).map(asReq).filter((r) => r.id));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, branchId, filterStatus]);

  async function advance(id: string, current: string | undefined) {
    const token = getStoredToken();
    if (!token) return;
    const next = current === 'PENDING' ? 'ACKNOWLEDGED' : current === 'ACKNOWLEDGED' ? 'RESOLVED' : 'RESOLVED';
    setPending(true);
    try {
      await patchAssistanceRequest(token, id, { status: next });
      toast.success(`Assistance → ${next}`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Beauty & Grooming"
        title="Live requests"
        description="Assistance requests created from QR conversations. Filter by status and mark acknowledged/resolved."
      />

      {!tenantId ? (
        <EmptyState icon="ph:bell-ringing-duotone" title="Select a tenant" description="Choose a tenant in the top bar." />
      ) : null}

      {tenantId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px]">
              <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}>
                {statuses.map((s) => (
                  <option key={s || 'ALL'} value={s}>
                    {s ? s : 'ALL'}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading}>
              Refresh
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-sm text-smoke-200">Loading…</p>
      ) : rows.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Created</Th>
              <Th>Status</Th>
              <Th>Station</Th>
              <Th>Target staff</Th>
              <Th>Notes</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="text-xs text-smoke-200">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</Td>
                <Td className="font-mono text-xs">{r.status ?? '—'}</Td>
                <Td className="font-mono text-xs">{r.stationId ? r.stationId.slice(0, 8) : '—'}</Td>
                <Td className="font-mono text-xs">{r.staffId ? r.staffId.slice(0, 8) : '—'}</Td>
                <Td className="text-xs text-smoke-200">{r.notes ? r.notes.slice(0, 80) : '—'}</Td>
                <Td className="text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending || r.status === 'RESOLVED' || r.status === 'CANCELLED'}
                    onClick={() => void advance(r.id, r.status)}
                  >
                    Advance
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState icon="ph:hand-heart-duotone" title="No assistance requests" description="Requests will appear after customers use the chat menu." />
      )}
    </div>
  );
}

