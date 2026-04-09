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
import { createStation, listStations, patchStation } from '@/lib/api/beauty-grooming';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

type StationRow = { id: string; code?: string; label?: string | null; status?: string; isActive?: boolean; notes?: string | null };

function asRow(x: unknown): StationRow {
  const o = (x ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    code: typeof o.code === 'string' ? o.code : undefined,
    label: typeof o.label === 'string' ? o.label : (o.label === null ? null : undefined),
    status: typeof o.status === 'string' ? o.status : undefined,
    isActive: typeof o.isActive === 'boolean' ? o.isActive : undefined,
    notes: typeof o.notes === 'string' ? o.notes : (o.notes === null ? null : undefined),
  };
}

const statuses = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE'] as const;

export default function BeautyStationsPage() {
  const { tenantId, branchId } = useScope();
  const [rows, setRows] = useState<StationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
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
      const list = await listStations(token, { tenantId, branchId: branchId ?? null });
      setRows((Array.isArray(list) ? list : []).map(asRow).filter((r) => r.id));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load stations');
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
      await createStation(token, { tenantId, branchId, code, label: label || null, status });
      toast.success('Station created');
      setCode('');
      setLabel('');
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
      await patchStation(token, id, { isActive: !(isActive ?? true) });
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
        title="Stations"
        description="Stations are branch-scoped. Select a branch to create and manage stations."
      />

      {!tenantId ? (
        <EmptyState icon="ph:armchair-duotone" title="Select a tenant" description="Choose a tenant in the top bar." />
      ) : !branchId ? (
        <EmptyState icon="ph:armchair-duotone" title="Select a branch" description="Stations require a branch scope." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create station</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="st-code">Code</Label>
                <Input id="st-code" value={code} onChange={(e) => setCode(e.target.value)} required placeholder="e.g. S1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-status">Status</Label>
                <Select id="st-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="st-label">Label (optional)</Label>
                <Input id="st-label" value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <Button type="submit" disabled={!canCreate || pending}>
                  {pending ? 'Saving…' : 'Create station'}
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
        <h3 className="font-display text-base font-semibold text-smoke-400">Stations</h3>
        {loading ? (
          <p className="text-sm text-smoke-200">Loading…</p>
        ) : rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Status</Th>
                <Th>Label</Th>
                <Th>Active</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className="font-mono text-xs">{r.code ?? '—'}</Td>
                  <Td className="font-mono text-xs">{r.status ?? '—'}</Td>
                  <Td>{r.label ?? '—'}</Td>
                  <Td>{r.isActive === false ? 'No' : 'Yes'}</Td>
                  <Td className="text-right">
                    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void toggleActive(r.id, r.isActive)}>
                      Toggle
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon="ph:armchair-duotone" title="No stations" description="Create your first station above." />
        )}
      </div>
    </div>
  );
}

