'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { Select } from '@/components/ui/select';
import { EntityQrCard } from '@/components/workspace/entity-qr-card';
import { ApiError } from '@/lib/api/client';
import { createTable, listTables, patchTable } from '@/lib/api/food-dining';
import { createQr, listQr, rotateQr, type QrMutationResult, type QrRecord } from '@/lib/api/qr';
import { getStoredToken } from '@/lib/auth/storage';
import {
  buildLaunchPageUrl,
  cacheQrLaunchPack,
  downloadQrSvgAsset,
  listCachedQrLaunchPacks,
  whatsappDeepLink,
} from '@/lib/qr-launch';
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

function safeFileToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'table';
}

function pickLatestQr(rows: QrRecord[]) {
  return [...rows].sort((a, b) => {
    const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
    const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
    const aRank = a.status === 'ACTIVE' ? 1 : 0;
    const bRank = b.status === 'ACTIVE' ? 1 : 0;
    return bRank - aRank || bTime - aTime;
  })[0] ?? null;
}

const statuses = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE'] as const;

export default function FoodDiningTablesPage() {
  const { tenantId, branchId } = useScope();
  const [rows, setRows] = useState<TableRow[]>([]);
  const [qrRows, setQrRows] = useState<QrRecord[]>([]);
  const [launchPacks, setLaunchPacks] = useState<Record<string, QrMutationResult>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [qrPendingId, setQrPendingId] = useState('');
  const [origin, setOrigin] = useState('');
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [capacity, setCapacity] = useState('');
  const [status, setStatus] = useState<(typeof statuses)[number]>('AVAILABLE');

  const canCreate = useMemo(() => Boolean(tenantId && branchId), [tenantId, branchId]);

  useEffect(() => {
    setOrigin(window.location.origin);
    setLaunchPacks(listCachedQrLaunchPacks());
  }, []);

  async function refresh() {
    const token = getStoredToken();
    if (!token || !tenantId) {
      setRows([]);
      setQrRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [tables, qrList] = await Promise.all([
        listTables(token, { tenantId, branchId: branchId ?? null }),
        listQr(token, tenantId),
      ]);
      setRows((Array.isArray(tables) ? tables : []).map(asRow).filter((r) => r.id));
      setQrRows(Array.isArray(qrList) ? qrList : []);
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

  const tableQrMap = useMemo(() => {
    const grouped = new Map<string, QrRecord[]>();
    for (const row of qrRows) {
      if (row.type !== 'TABLE_QR' || !row.diningTableId) continue;
      const bucket = grouped.get(row.diningTableId) ?? [];
      bucket.push(row);
      grouped.set(row.diningTableId, bucket);
    }
    return new Map(Array.from(grouped.entries()).map(([id, items]) => [id, pickLatestQr(items)]));
  }, [qrRows]);

  async function handleQrMutation(row: TableRow) {
    const token = getStoredToken();
    if (!token || !tenantId || !branchId) return;
    const existingQr = tableQrMap.get(row.id) ?? null;
    setQrPendingId(row.id);
    try {
      const launchPack = existingQr
        ? await rotateQr(token, existingQr.id)
        : await createQr(token, {
            tenantId,
            branchId,
            type: 'TABLE_QR',
            diningTableId: row.id,
          });
      cacheQrLaunchPack(launchPack);
      setLaunchPacks((current) => ({ ...current, [launchPack.id]: launchPack }));
      toast.success(existingQr ? 'Table QR refreshed' : 'Table QR generated');
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not prepare table QR');
    } finally {
      setQrPendingId('');
    }
  }

  async function handleDownloadQr(row: TableRow) {
    const qr = tableQrMap.get(row.id) ?? null;
    const launchPack = qr ? launchPacks[qr.id] ?? null : null;
    const launchUrl = launchPack ? buildLaunchPageUrl(origin, launchPack) : null;
    if (!launchUrl || !qr) {
      toast.error('Refresh this QR first to load the printable QR');
      return;
    }
    try {
      await downloadQrSvgAsset(launchUrl, `${safeFileToken(row.code ?? row.id)}-${qr.publicRef}`);
      toast.success('QR downloaded');
    } catch {
      toast.error('Could not download QR');
    }
  }

  function handleOpenLaunch(row: TableRow) {
    const qr = tableQrMap.get(row.id) ?? null;
    const launchPack = qr ? launchPacks[qr.id] ?? null : null;
    const launchUrl = launchPack ? buildLaunchPageUrl(origin, launchPack) : null;
    if (!launchUrl) {
      toast.error('Refresh this QR first to load the launch page');
      return;
    }
    window.open(launchUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Food & Dining"
        title="Tables"
        description="Create tables and issue QR cards."
      />

      {!tenantId ? (
        <EmptyState icon="ph:table-duotone" title="Select a tenant" description="Choose a tenant in the top bar." />
      ) : !branchId ? (
        <EmptyState icon="ph:table-duotone" title="Select a branch" description="Tables require a branch scope." />
      ) : (
        <Card className="border-smoke-400/10 shadow-card">
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
                <Label htmlFor="t-label">Label</Label>
                <Input id="t-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Window seat" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-cap">Capacity</Label>
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
        <h3 className="font-display text-base font-semibold text-smoke-400">Table QR board</h3>
        {loading ? (
          <p className="text-sm text-smoke-200">Loading…</p>
        ) : rows.length ? (
          <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {rows.map((row) => {
              const qr = tableQrMap.get(row.id) ?? null;
              const launchPack = qr ? launchPacks[qr.id] ?? null : null;
              const launchPageUrl = launchPack ? buildLaunchPageUrl(origin, launchPack) : null;
              const launchLink = launchPack?.customerLaunch?.prefillText
                ? whatsappDeepLink(launchPack.customerLaunch.prefillText)
                : null;

              return (
                <EntityQrCard
                  key={row.id}
                  tone="table"
                  variant="compact"
                  title={row.label ?? row.code ?? 'Table'}
                  subtitle={`Dining table · ${row.status?.replaceAll('_', ' ') ?? 'AVAILABLE'}`}
                  code={row.code ?? row.id.slice(0, 8)}
                  qrLabel={qr ? qr.publicRef : 'No QR issued'}
                  qrValue={launchPageUrl}
                  previewReady={Boolean(launchPageUrl)}
                  previewHint={
                    launchPageUrl
                      ? 'Scan to open the customer WhatsApp entry for this table.'
                      : 'Generate or refresh this QR to load the launch preview here.'
                  }
                  statusLabel={row.isActive === false ? 'Inactive' : (row.status?.replaceAll('_', ' ') ?? 'Ready')}
                  metrics={[
                    {
                      label: 'Scans',
                      value: String(qr?.scanCount ?? 0),
                      hint: qr?.lastScannedAt ? new Date(qr.lastScannedAt).toLocaleDateString() : 'No scans yet',
                    },
                    {
                      label: 'Capacity',
                      value: String(row.capacity ?? '—'),
                      hint: row.label ?? 'Dining floor',
                    },
                    {
                      label: 'Scope',
                      value: row.isActive === false ? 'Paused' : 'Live',
                      hint: branchId ? 'Branch QR' : 'Tenant QR',
                    },
                  ]}
                  actions={[
                    {
                      key: 'generate',
                      label: qr ? 'Refresh QR' : 'Generate QR',
                      icon: qr ? 'fluent-color:arrow-sync-circle-24' : 'fluent-color:qr-code-24',
                      onClick: () => void handleQrMutation(row),
                      disabled: qrPendingId === row.id,
                      variant: 'primary',
                    },
                    {
                      key: 'download',
                      label: 'Download',
                      icon: 'fluent-color:arrow-download-24',
                      onClick: () => void handleDownloadQr(row),
                      disabled: !launchPageUrl || qrPendingId === row.id,
                      variant: 'outline',
                    },
                    launchLink
                      ? {
                          key: 'open',
                          label: 'Open launch',
                          icon: 'fluent-color:open-24',
                          onClick: () => handleOpenLaunch(row),
                          disabled: qrPendingId === row.id,
                          variant: 'ghost',
                        }
                      : {
                          key: 'desk',
                          label: 'QR desk',
                          icon: 'fluent-color:panel-left-contract-20',
                          href: `/dashboard/qr?type=TABLE_QR&tableId=${encodeURIComponent(row.id)}&scope=branch`,
                          variant: 'ghost',
                        },
                    {
                      key: 'toggle',
                      label: row.isActive === false ? 'Enable' : 'Disable',
                      icon: row.isActive === false ? 'fluent-color:play-circle-24' : 'fluent-color:pause-circle-24',
                      onClick: () => void toggleActive(row.id, row.isActive),
                      disabled: pending,
                      variant: 'ghost',
                    },
                  ]}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState icon="ph:table-duotone" title="No tables" description="Create your first table above." />
        )}
      </div>
    </div>
  );
}
