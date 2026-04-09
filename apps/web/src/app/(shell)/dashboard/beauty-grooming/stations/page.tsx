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
import { createStation, listStations, patchStation } from '@/lib/api/beauty-grooming';
import { ApiError } from '@/lib/api/client';
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

type StationRow = {
  id: string;
  code?: string;
  label?: string | null;
  status?: string;
  isActive?: boolean;
  notes?: string | null;
};

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

function safeFileToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'station';
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

export default function BeautyStationsPage() {
  const { tenantId, branchId } = useScope();
  const [rows, setRows] = useState<StationRow[]>([]);
  const [qrRows, setQrRows] = useState<QrRecord[]>([]);
  const [launchPacks, setLaunchPacks] = useState<Record<string, QrMutationResult>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [qrPendingId, setQrPendingId] = useState('');
  const [origin, setOrigin] = useState('');
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
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
      const [stations, qrList] = await Promise.all([
        listStations(token, { tenantId, branchId: branchId ?? null }),
        listQr(token, tenantId),
      ]);
      setRows((Array.isArray(stations) ? stations : []).map(asRow).filter((r) => r.id));
      setQrRows(Array.isArray(qrList) ? qrList : []);
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

  const stationQrMap = useMemo(() => {
    const grouped = new Map<string, QrRecord[]>();
    for (const row of qrRows) {
      if (row.type !== 'STATION_QR' || !row.beautyStationId) continue;
      const bucket = grouped.get(row.beautyStationId) ?? [];
      bucket.push(row);
      grouped.set(row.beautyStationId, bucket);
    }
    return new Map(Array.from(grouped.entries()).map(([id, items]) => [id, pickLatestQr(items)]));
  }, [qrRows]);

  async function handleQrMutation(row: StationRow) {
    const token = getStoredToken();
    if (!token || !tenantId || !branchId) return;
    const existingQr = stationQrMap.get(row.id) ?? null;
    setQrPendingId(row.id);
    try {
      const launchPack = existingQr
        ? await rotateQr(token, existingQr.id)
        : await createQr(token, {
            tenantId,
            branchId,
            type: 'STATION_QR',
            beautyStationId: row.id,
          });
      cacheQrLaunchPack(launchPack);
      setLaunchPacks((current) => ({ ...current, [launchPack.id]: launchPack }));
      toast.success(existingQr ? 'Station QR refreshed' : 'Station QR generated');
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not prepare station QR');
    } finally {
      setQrPendingId('');
    }
  }

  async function handleDownloadQr(row: StationRow) {
    const qr = stationQrMap.get(row.id) ?? null;
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

  function handleOpenLaunch(row: StationRow) {
    const qr = stationQrMap.get(row.id) ?? null;
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
        eyebrow="Beauty & Grooming"
        title="Stations"
        description="Create stations and issue QR cards."
      />

      {!tenantId ? (
        <EmptyState icon="ph:armchair-duotone" title="Select a tenant" description="Choose a tenant in the top bar." />
      ) : !branchId ? (
        <EmptyState icon="ph:armchair-duotone" title="Select a branch" description="Stations require a branch scope." />
      ) : (
        <Card className="border-smoke-400/10 shadow-card">
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
                <Label htmlFor="st-label">Label</Label>
                <Input id="st-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Chair 1 · Braids" />
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
        <h3 className="font-display text-base font-semibold text-smoke-400">Station QR board</h3>
        {loading ? (
          <p className="text-sm text-smoke-200">Loading…</p>
        ) : rows.length ? (
          <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {rows.map((row) => {
              const qr = stationQrMap.get(row.id) ?? null;
              const launchPack = qr ? launchPacks[qr.id] ?? null : null;
              const launchPageUrl = launchPack ? buildLaunchPageUrl(origin, launchPack) : null;
              const launchLink = launchPack?.customerLaunch?.prefillText
                ? whatsappDeepLink(launchPack.customerLaunch.prefillText)
                : null;

              return (
                <EntityQrCard
                  key={row.id}
                  tone="station"
                  variant="compact"
                  title={row.label ?? row.code ?? 'Station'}
                  subtitle={`Salon station · ${row.status?.replaceAll('_', ' ') ?? 'AVAILABLE'}`}
                  code={row.code ?? row.id.slice(0, 8)}
                  qrLabel={qr ? qr.publicRef : 'No QR issued'}
                  qrValue={launchPageUrl}
                  previewReady={Boolean(launchPageUrl)}
                  previewHint={
                    launchPageUrl
                      ? 'Scan to open the customer WhatsApp entry for this station.'
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
                      label: 'Lane',
                      value: row.status === 'OUT_OF_SERVICE' ? 'Off floor' : 'Customer',
                      hint: row.label ?? 'Service station',
                    },
                    {
                      label: 'Scope',
                      value: row.isActive === false ? 'Paused' : 'Live',
                      hint: 'Branch QR',
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
                          href: `/dashboard/qr?type=STATION_QR&stationId=${encodeURIComponent(row.id)}&scope=branch`,
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
          <EmptyState icon="ph:armchair-duotone" title="No stations" description="Create your first station above." />
        )}
      </div>
    </div>
  );
}
