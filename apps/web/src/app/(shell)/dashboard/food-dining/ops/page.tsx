'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { Select } from '@/components/ui/select';
import { Table, Td, Th } from '@/components/ui/table';
import { ApiError } from '@/lib/api/client';
import { listBillRequests, listWaiterCalls, patchBillRequest, patchWaiterCall } from '@/lib/api/food-dining';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

type ReqRow = {
  id: string;
  status?: string;
  branchId?: string;
  tableId?: string | null;
  createdAt?: string;
  notes?: string | null;
};

function asReq(x: unknown): ReqRow {
  const o = (x ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    status: typeof o.status === 'string' ? o.status : undefined,
    branchId: typeof o.branchId === 'string' ? o.branchId : undefined,
    tableId: typeof o.tableId === 'string' ? o.tableId : (o.tableId === null ? null : undefined),
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : undefined,
    notes: typeof o.notes === 'string' ? o.notes : (o.notes === null ? null : undefined),
  };
}

const statuses = ['', 'PENDING', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED'] as const;

export default function FoodDiningOpsPage() {
  const { tenantId, branchId } = useScope();
  const [waiterCalls, setWaiterCalls] = useState<ReqRow[]>([]);
  const [billRequests, setBillRequests] = useState<ReqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [filterStatus, setFilterStatus] = useState<(typeof statuses)[number]>('');

  async function refresh() {
    const token = getStoredToken();
    if (!token || !tenantId) {
      setWaiterCalls([]);
      setBillRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [wc, br] = await Promise.all([
        listWaiterCalls(token, { tenantId, branchId: branchId ?? null, status: filterStatus || null }),
        listBillRequests(token, { tenantId, branchId: branchId ?? null, status: filterStatus || null }),
      ]);
      setWaiterCalls((Array.isArray(wc) ? wc : []).map(asReq).filter((r) => r.id));
      setBillRequests((Array.isArray(br) ? br : []).map(asReq).filter((r) => r.id));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load operations');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, branchId, filterStatus]);

  async function advanceWaiter(id: string, current: string | undefined) {
    const token = getStoredToken();
    if (!token) return;
    const next = current === 'PENDING' ? 'ACKNOWLEDGED' : current === 'ACKNOWLEDGED' ? 'RESOLVED' : 'RESOLVED';
    setPending(true);
    try {
      await patchWaiterCall(token, id, { status: next });
      toast.success(`Waiter call → ${next}`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    } finally {
      setPending(false);
    }
  }

  async function advanceBill(id: string, current: string | undefined) {
    const token = getStoredToken();
    if (!token) return;
    const next = current === 'PENDING' ? 'ACKNOWLEDGED' : current === 'ACKNOWLEDGED' ? 'RESOLVED' : 'RESOLVED';
    setPending(true);
    try {
      await patchBillRequest(token, id, { status: next });
      toast.success(`Bill request → ${next}`);
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
        eyebrow="Food & Dining"
        title="Live requests"
        description="Waiter calls and bill requests created from QR conversations. Filter by status and mark them acknowledged/resolved."
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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="font-display text-base font-semibold text-smoke-400">Waiter calls</h3>
          {loading ? (
            <p className="text-sm text-smoke-200">Loading…</p>
          ) : waiterCalls.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Created</Th>
                  <Th>Status</Th>
                  <Th>Table</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {waiterCalls.map((r) => (
                  <tr key={r.id}>
                    <Td className="text-xs text-smoke-200">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</Td>
                    <Td className="font-mono text-xs">{r.status ?? '—'}</Td>
                    <Td className="font-mono text-xs">{r.tableId ? r.tableId.slice(0, 8) : '—'}</Td>
                    <Td className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending || r.status === 'RESOLVED' || r.status === 'CANCELLED'}
                        onClick={() => void advanceWaiter(r.id, r.status)}
                      >
                        Advance
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState icon="ph:hand-waving-duotone" title="No waiter calls" description="Calls will appear after customers use the chat menu." />
          )}
        </div>

        <div className="space-y-3">
          <h3 className="font-display text-base font-semibold text-smoke-400">Bill requests</h3>
          {loading ? (
            <p className="text-sm text-smoke-200">Loading…</p>
          ) : billRequests.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Created</Th>
                  <Th>Status</Th>
                  <Th>Table</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {billRequests.map((r) => (
                  <tr key={r.id}>
                    <Td className="text-xs text-smoke-200">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</Td>
                    <Td className="font-mono text-xs">{r.status ?? '—'}</Td>
                    <Td className="font-mono text-xs">{r.tableId ? r.tableId.slice(0, 8) : '—'}</Td>
                    <Td className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending || r.status === 'RESOLVED' || r.status === 'CANCELLED'}
                        onClick={() => void advanceBill(r.id, r.status)}
                      >
                        Advance
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState icon="ph:receipt-duotone" title="No bill requests" description="Requests will appear after customers request a bill in chat." />
          )}
        </div>
      </div>
    </div>
  );
}

