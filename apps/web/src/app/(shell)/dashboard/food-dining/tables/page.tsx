'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { Select } from '@/components/ui/select';
import { Table, Td, Th } from '@/components/ui/table';
import { ApiError } from '@/lib/api/client';
import { createTable, listTables, patchTable } from '@/lib/api/food-dining';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

type TableRow = {
  id: string;
  code?: string;
  label?: string | null;
  capacity?: number | null;
  status?: string;
  isActive?: boolean;
};

function asRow(x: unknown): TableRow {
  const o = (x ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    code: typeof o.code === 'string' ? o.code : undefined,
    label: typeof o.label === 'string' ? o.label : (o.label === null ? null : undefined),
    capacity: typeof o.capacity === 'number' ? o.capacity : (o.capacity === null ? null : undefined),
    status: typeof o.status === 'string' ? o.status : undefined,
    isActive: typeof o.isActive === 'boolean' ? o.isActive : undefined,
  };
}

const statuses = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE'] as const;

export default function FoodDiningTablesPage() {
  const { tenantId, branchId } = useScope();
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [capacity, setCapacity] = useState('');
  const [status, setStatus] = useState<(typeof statuses)[number]>('AVAILABLE');

  const canCreate = useMemo(() => Boolean(tenantId && branchId), [tenantId, branchId]);

  async function refresh() {
    const token = getStoredToken();
    if (!token || !tenantId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await listTables(token, { tenantId, branchId: branchId ?? null });
      setRows((Array.isArray(list) ? list : []).map(asRow).filter((r) => r.id));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load tables');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, branchId]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const token = getStoredToken();
    if (!token || !tenantId || !branchId) return;
    setPending(true);
    try {
      await createTable(token, {
        tenantId,
        branchId,
        code,
        label: label || null,
        capacity: capacity ? Math.max(0, Math.floor(Number(capacity) || 0)) : null,
        status,
      });
      toast.success('Table created');
      setCode('');
      setLabel('');
      setCapacity('');
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Create failed');
    } finally {
      setPending(false);
    }
  }

  async function toggleActive(id: string, isActive: boolean | undefined) {
    const token = getStoredToken();
    if (!token) return;
    setPending(true);
    try {
      await patchTable(token, id, { isActive: !(isActive ?? true) });
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
        title="Tables"
        description="Tables are branch-scoped. Select a branch to create and manage tables."
      />

      {!tenantId ? (
        <EmptyState icon="ph:table-duotone" title="Select a tenant" description="Choose a tenant in the top bar." />
      ) : !branchId ? (
        <EmptyState icon="ph:table-duotone" title="Select a branch" description="Tables require a branch scope." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create table</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="t-code">Code</Label>
                <Input id="t-code" value={code} onChange={(e) => setCode(e.target.value)} required placeholder="e.g. T01" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-status">Status</Label>
                <Select id="t-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-label">Label (optional)</Label>
                <Input id="t-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Window seat" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-cap">Capacity (optional)</Label>
                <Input id="t-cap" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="e.g. 4" />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <Button type="submit" disabled={!canCreate || pending}>
                  {pending ? 'Saving…' : 'Create table'}
                </Button>
                <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading}>
                  Refresh
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h3 className="font-display text-base font-semibold text-smoke-400">Tables</h3>
        {loading ? (
          <p className="text-sm text-smoke-200">Loading…</p>
        ) : rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Status</Th>
                <Th>Capacity</Th>
                <Th>Label</Th>
                <Th>Active</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <Td className="font-mono text-xs">{t.code ?? '—'}</Td>
                  <Td className="font-mono text-xs">{t.status ?? '—'}</Td>
                  <Td>{t.capacity ?? '—'}</Td>
                  <Td>{t.label ?? '—'}</Td>
                  <Td>{t.isActive === false ? 'No' : 'Yes'}</Td>
                  <Td className="text-right">
                    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void toggleActive(t.id, t.isActive)}>
                      Toggle
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon="ph:table-duotone" title="No tables" description="Create your first table above." />
        )}
      </div>
    </div>
  );
}

