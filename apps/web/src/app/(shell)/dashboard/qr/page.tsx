'use client';

import { Icon } from '@iconify/react';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
import { QrSvg } from '@/components/ui/qr-svg';
import { SectionHeader } from '@/components/ui/section-header';
import { Select } from '@/components/ui/select';
import { Table, Td, Th } from '@/components/ui/table';
import { listStations } from '@/lib/api/beauty-grooming';
import { ApiError } from '@/lib/api/client';
import { listTables } from '@/lib/api/food-dining';
import {
  createQr,
  listQr,
  revokeQr,
  rotateQr,
  type QrMutationResult,
  type QrRecord,
  type QrType,
} from '@/lib/api/qr';
import { listStaff } from '@/lib/api/staff';
import { hasCategory } from '@/lib/business-categories';
import { getStoredToken } from '@/lib/auth/storage';
import { compactText } from '@/lib/copy';
import { renderQrSvg } from '@/lib/qr';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

type StaffOption = {
  id: string;
  displayName: string;
  publicHandle?: string | null;
};

type TableOption = {
  id: string;
  code: string;
  label?: string | null;
};

type StationOption = {
  id: string;
  code: string;
  label?: string | null;
};

function asStaffOption(x: unknown): StaffOption | null {
  const o = (x ?? {}) as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : '';
  const displayName = typeof o.displayName === 'string' ? o.displayName : '';
  if (!id || !displayName) return null;
  return {
    id,
    displayName,
    publicHandle: typeof o.publicHandle === 'string' ? o.publicHandle : (o.publicHandle === null ? null : undefined),
  };
}

function asTableOption(x: unknown): TableOption | null {
  const o = (x ?? {}) as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : '';
  const code = typeof o.code === 'string' ? o.code : '';
  if (!id || !code) return null;
  return {
    id,
    code,
    label: typeof o.label === 'string' ? o.label : (o.label === null ? null : undefined),
  };
}

function asStationOption(x: unknown): StationOption | null {
  const o = (x ?? {}) as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : '';
  const code = typeof o.code === 'string' ? o.code : '';
  if (!id || !code) return null;
  return {
    id,
    code,
    label: typeof o.label === 'string' ? o.label : (o.label === null ? null : undefined),
  };
}

function formatLinkedTarget(row: QrRecord): string {
  const target = row.linkedTarget;
  if (!target) {
    return 'Business entry';
  }
  if (target.kind === 'STAFF') {
    return target.handle ? `${target.label} · @${target.handle}` : target.label;
  }
  if (target.kind === 'TABLE' || target.kind === 'STATION') {
    return `${target.code}${target.label && target.label !== target.code ? ` · ${target.label}` : ''}`;
  }
  return target.label || 'Business entry';
}

function formatScope(row: QrRecord): string {
  if (row.branch) {
    return `${row.branch.name} (${row.branch.code})`;
  }
  return 'Tenant-wide';
}

function whatsappDeepLink(prefillText: string): string | null {
  const rawNumber = process.env.NEXT_PUBLIC_TIPTAP_WHATSAPP_NUMBER ?? '';
  const digits = rawNumber.replace(/\D/g, '');
  if (!digits) {
    return null;
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(prefillText)}`;
}

function buildLaunchPageUrl(origin: string, record: QrMutationResult): string | null {
  const prefillText = record.customerLaunch?.prefillText;
  if (!origin || !prefillText) {
    return null;
  }
  const params = new URLSearchParams({
    text: prefillText,
    ref: record.publicRef,
    target: formatLinkedTarget(record),
    scope: formatScope(record),
    type: record.type,
  });
  return `${origin}/launch/whatsapp?${params.toString()}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`);
  }
}

function QrManagementPageInner() {
  const searchParams = useSearchParams();
  const { tenantId, branchId, tenants, branches, tenantCategories, loading: scopeLoading } = useScope();
  const hasFoodDining = hasCategory(tenantCategories, 'FOOD_DINING');
  const hasBeautyGrooming = hasCategory(tenantCategories, 'BEAUTY_GROOMING');
  const [rows, setRows] = useState<QrRecord[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [tableOptions, setTableOptions] = useState<TableOption[]>([]);
  const [stationOptions, setStationOptions] = useState<StationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<QrType>('BUSINESS_QR');
  const [forBranch, setForBranch] = useState(true);
  const [staffId, setStaffId] = useState('');
  const [diningTableId, setDiningTableId] = useState('');
  const [beautyStationId, setBeautyStationId] = useState('');
  const [pending, setPending] = useState(false);
  const [launchPack, setLaunchPack] = useState<QrMutationResult | null>(null);
  const [origin, setOrigin] = useState('');

  const canCreate = useMemo(
    () => Boolean(tenantId && (!forBranch || branchId)),
    [branchId, forBranch, tenantId],
  );

  const selectedStaff = useMemo(
    () => staffOptions.find((item) => item.id === staffId) ?? null,
    [staffId, staffOptions],
  );
  const selectedTable = useMemo(
    () => tableOptions.find((item) => item.id === diningTableId) ?? null,
    [diningTableId, tableOptions],
  );
  const selectedStation = useMemo(
    () => stationOptions.find((item) => item.id === beautyStationId) ?? null,
    [beautyStationId, stationOptions],
  );
  const tenantName = useMemo(
    () => tenants.find((item) => item.id === tenantId)?.name ?? 'TIPTAP Business',
    [tenantId, tenants],
  );
  const activeBranchName = useMemo(
    () => branches.find((item) => item.id === branchId)?.name ?? null,
    [branchId, branches],
  );
  const launchLink = launchPack?.customerLaunch?.prefillText
    ? whatsappDeepLink(launchPack.customerLaunch.prefillText)
    : null;
  const launchPageUrl = useMemo(
    () => (launchPack ? buildLaunchPageUrl(origin, launchPack) : null),
    [launchPack, origin],
  );

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const requestedType = searchParams.get('type');
    if (
      requestedType === 'BUSINESS_QR' ||
      requestedType === 'STAFF_QR' ||
      requestedType === 'TABLE_QR' ||
      requestedType === 'STATION_QR'
    ) {
      setType(requestedType);
    }
    const requestedScope = searchParams.get('scope');
    if (requestedScope === 'tenant' || requestedScope === 'branch') {
      setForBranch(requestedScope === 'branch');
    }
    const requestedStaffId = searchParams.get('staffId');
    if (requestedStaffId) {
      setType('STAFF_QR');
      setStaffId(requestedStaffId);
    }
    const requestedTableId = searchParams.get('tableId');
    if (requestedTableId) {
      setType('TABLE_QR');
      setDiningTableId(requestedTableId);
    }
    const requestedStationId = searchParams.get('stationId');
    if (requestedStationId) {
      setType('STATION_QR');
      setBeautyStationId(requestedStationId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (type !== 'STAFF_QR') setStaffId('');
    if (type !== 'TABLE_QR') setDiningTableId('');
    if (type !== 'STATION_QR') setBeautyStationId('');
  }, [type]);

  useEffect(() => {
    if (scopeLoading) {
      return;
    }
    if (type === 'TABLE_QR' && !hasFoodDining) {
      setType('BUSINESS_QR');
    }
    if (type === 'STATION_QR' && !hasBeautyGrooming) {
      setType('BUSINESS_QR');
    }
  }, [type, hasFoodDining, hasBeautyGrooming, scopeLoading]);

  async function printLaunchCard() {
    if (!launchPack) {
      return;
    }
    const handoffText = launchPack.customerLaunch?.prefillText ?? launchPack.rawToken ?? '';
    const qrSvg = launchPageUrl
      ? await renderQrSvg(launchPageUrl, {
          size: 320,
          margin: 1,
          foreground: '#111827',
          background: '#FFFDF8FF',
        })
      : '';
    const popup = window.open('', '_blank', 'noopener,noreferrer,width=920,height=1100');
    if (!popup) {
      toast.error('Could not open print window');
      return;
    }
    const title = escapeHtml(tenantName);
    const target = escapeHtml(formatLinkedTarget(launchPack));
    const scope = escapeHtml(formatScope(launchPack));
    const ref = escapeHtml(launchPack.publicRef);
    const branch = escapeHtml(activeBranchName ?? scope);
    const launchUrl = escapeHtml(launchPageUrl ?? 'Launch URL unavailable on this device');
    const handoff = escapeHtml(handoffText);
    popup.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>TIPTAP Launch Card</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: #f4efe5; color: #1f2937; }
      .page { padding: 32px; }
      .card { background: #fffdf8; border: 1px solid rgba(31,41,55,0.08); border-radius: 28px; padding: 28px; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08); }
      .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.28em; text-transform: uppercase; color: #6b7280; }
      h1 { margin: 10px 0 0; font-size: 34px; line-height: 1.1; }
      .muted { color: #6b7280; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 22px; }
      .block { border: 1px solid rgba(31,41,55,0.08); background: #f8f5ed; border-radius: 18px; padding: 14px; }
      .label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #6b7280; }
      .value { margin-top: 8px; font-size: 15px; font-weight: 600; color: #111827; }
      .mono { font-family: "SFMono-Regular", Menlo, Consolas, monospace; }
      .deploy-grid { display:grid; grid-template-columns: minmax(240px, 300px) 1fr; gap: 18px; margin-top: 22px; align-items: start; }
      .qr-wrap { border: 1px solid rgba(31,41,55,0.08); background: white; border-radius: 24px; padding: 18px; display:flex; align-items:center; justify-content:center; min-height: 320px; }
      .qr-wrap svg { width: 100%; height: auto; display:block; }
      .hero { margin-top: 22px; padding: 18px; border-radius: 22px; background: #111827; color: #f9fafb; }
      .hero pre { margin: 10px 0 0; white-space: pre-wrap; word-break: break-word; font-size: 14px; }
      .list { margin-top: 22px; display: grid; gap: 12px; }
      .list-item { border: 1px solid rgba(31,41,55,0.08); background: white; border-radius: 18px; padding: 14px; line-height: 1.5; }
      .footer { margin-top: 18px; font-size: 12px; color: #6b7280; }
      @media print { body { background: white; } .page { padding: 0; } .card { box-shadow: none; border-radius: 0; border: 0; } }
    </style>
  </head>
  <body>
    <div class="page">
      <section class="card">
        <div class="eyebrow">TIPTAP deployment</div>
        <h1>${title}</h1>
        <p class="muted">Use this card when issuing or handing off a fresh QR launch flow to your floor team.</p>
        <div class="grid">
          <div class="block"><div class="label">Public ref</div><div class="value mono">${ref}</div></div>
          <div class="block"><div class="label">Entry type</div><div class="value">${escapeHtml(launchPack.type.replace(/_/g, ' '))}</div></div>
          <div class="block"><div class="label">Target</div><div class="value">${target}</div></div>
          <div class="block"><div class="label">Scope</div><div class="value">${branch}</div></div>
        </div>
        <div class="deploy-grid">
          <div class="qr-wrap">${qrSvg || '<div class="muted">QR preview unavailable</div>'}</div>
          <div>
            <div class="hero" style="margin-top:0;">
              <div class="label" style="color:#9ca3af;">WhatsApp handoff text</div>
              <pre class="mono">${handoff}</pre>
            </div>
            <div class="block" style="margin-top:18px;">
              <div class="label">Deployment URL</div>
              <div class="value mono" style="font-size:13px; line-height:1.55;">${launchUrl}</div>
            </div>
          </div>
        </div>
        <div class="list">
          <div class="list-item">1. If you are printing a QR sticker, encode the deployment URL above into the QR.</div>
          <div class="list-item">2. When the customer scans it, TIPTAP will open the WhatsApp handoff page and continue into the correct service flow.</div>
          <div class="list-item">3. If needed, the floor team can still paste the handoff text manually into WhatsApp.</div>
        </div>
        <p class="footer">Generated from TIPTAP QR launch control.</p>
      </section>
    </div>
    <script>window.onload = () => window.print();</script>
  </body>
</html>`);
    popup.document.close();
  }

  async function refresh() {
    const token = getStoredToken();
    if (!token || !tenantId) {
      setRows([]);
      setStaffOptions([]);
      setTableOptions([]);
      setStationOptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [qrList, staffList, tableList, stationList] = await Promise.all([
        listQr(token, tenantId),
        listStaff(token, tenantId),
        branchId && hasFoodDining ? listTables(token, { tenantId, branchId }) : Promise.resolve([]),
        branchId && hasBeautyGrooming ? listStations(token, { tenantId, branchId }) : Promise.resolve([]),
      ]);
      setRows(Array.isArray(qrList) ? qrList : []);
      setStaffOptions(
        (Array.isArray(staffList) ? staffList : [])
          .map(asStaffOption)
          .filter((item): item is StaffOption => Boolean(item)),
      );
      setTableOptions(
        (Array.isArray(tableList) ? tableList : [])
          .map(asTableOption)
          .filter((item): item is TableOption => Boolean(item)),
      );
      setStationOptions(
        (Array.isArray(stationList) ? stationList : [])
          .map(asStationOption)
          .filter((item): item is StationOption => Boolean(item)),
      );
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load QR workspace');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, branchId, hasFoodDining, hasBeautyGrooming]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const token = getStoredToken();
    if (!token || !tenantId) {
      return;
    }
    setPending(true);
    setLaunchPack(null);
    try {
      const res = await createQr(token, {
        tenantId,
        type,
        branchId: forBranch ? branchId : null,
        staffId: type === 'STAFF_QR' ? staffId || null : null,
        diningTableId: type === 'TABLE_QR' ? diningTableId || null : null,
        beautyStationId: type === 'STATION_QR' ? beautyStationId || null : null,
      });
      setLaunchPack(res);
      toast.success('QR created');
      setStaffId('');
      setDiningTableId('');
      setBeautyStationId('');
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Create failed');
    } finally {
      setPending(false);
    }
  }

  async function onRotate(id: string) {
    const token = getStoredToken();
    if (!token) return;
    setPending(true);
    setLaunchPack(null);
    try {
      const res = await rotateQr(token, id);
      setLaunchPack(res);
      toast.success('QR rotated');
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Rotate failed');
    } finally {
      setPending(false);
    }
  }

  async function onRevoke(id: string) {
    const token = getStoredToken();
    if (!token) return;
    setPending(true);
    try {
      await revokeQr(token, id);
      toast.success('QR revoked');
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Revoke failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        eyebrow="Operations"
        title="QR launch control"
        description="Create business, staff, table, or station QR entry points, then hand customers straight into WhatsApp with the right context."
      />

      {!tenantId ? (
        <EmptyState
          icon="ph:qr-code-duotone"
          title="Select a tenant"
          description="Choose a tenant in the top bar to list and create QR codes."
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
          <Card className="border-smoke-400/10 shadow-card">
            <CardHeader className="border-b border-smoke-400/[0.06]">
              <CardTitle className="text-base">Create QR</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={onCreate} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="qr-type">Type</Label>
                  <Select id="qr-type" value={type} onChange={(e) => setType(e.target.value as QrType)}>
                    <option value="BUSINESS_QR">Business entry</option>
                    <option value="STAFF_QR">Staff host</option>
                    <option value="TABLE_QR" disabled={!hasFoodDining}>
                      Dining table
                      {!hasFoodDining ? ' — enable Food & Dining in Setup → Categories' : ''}
                    </option>
                    <option value="STATION_QR" disabled={!hasBeautyGrooming}>
                      Salon station
                      {!hasBeautyGrooming ? ' — enable Beauty & Grooming in Setup → Categories' : ''}
                    </option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qr-branch">Scope</Label>
                  <Select
                    id="qr-branch"
                    value={forBranch ? 'branch' : 'tenant'}
                    onChange={(e) => setForBranch(e.target.value === 'branch')}
                  >
                    <option value="branch">Selected branch</option>
                    <option value="tenant">Tenant-wide</option>
                  </Select>
                  <p className="text-xs text-smoke-200">
                    {branchId ? 'Uses the selected branch.' : 'Pick a branch for branch QR.'}
                  </p>
                </div>

                {type === 'STAFF_QR' ? (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="qr-staff">Host staff member</Label>
                    <Select id="qr-staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                      <option value="">Select staff</option>
                      {staffOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.displayName}
                          {item.publicHandle ? ` (@${item.publicHandle})` : ''}
                        </option>
                      ))}
                    </Select>
                    <p className="text-xs text-smoke-200">
                      {selectedStaff ? `Hosted by ${selectedStaff.displayName}.` : 'Pick the staff member.'}
                    </p>
                  </div>
                ) : null}

                {type === 'TABLE_QR' ? (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="qr-table">Dining table</Label>
                    <Select id="qr-table" value={diningTableId} onChange={(e) => setDiningTableId(e.target.value)}>
                      <option value="">Select table</option>
                      {tableOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code}
                          {item.label ? ` - ${item.label}` : ''}
                        </option>
                      ))}
                    </Select>
                    <p className="text-xs text-smoke-200">
                      {!hasFoodDining
                        ? 'Turn on Food & Dining under Setup → Categories, then add tables in Food & Dining.'
                        : selectedTable
                          ? `Bound to table ${selectedTable.code}.`
                          : 'Select a table first.'}
                    </p>
                  </div>
                ) : null}

                {type === 'STATION_QR' ? (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="qr-station">Salon station</Label>
                    <Select id="qr-station" value={beautyStationId} onChange={(e) => setBeautyStationId(e.target.value)}>
                      <option value="">Select station</option>
                      {stationOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code}
                          {item.label ? ` - ${item.label}` : ''}
                        </option>
                      ))}
                    </Select>
                    <p className="text-xs text-smoke-200">
                      {!hasBeautyGrooming
                        ? 'Turn on Beauty & Grooming under Setup → Categories, then add stations in Beauty & Grooming.'
                        : selectedStation
                          ? `Bound to station ${selectedStation.code}.`
                          : 'Select a station first.'}
                    </p>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-smoke-400/[0.06] bg-ivory-50/80 p-4 md:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Customer journey</p>
                  <p className="mt-2 text-[13px] text-smoke-300">Scan QR, open WhatsApp, continue in the right context.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                  <Button
                    type="submit"
                    disabled={
                      !canCreate ||
                      pending ||
                      (type === 'STAFF_QR' && !staffId) ||
                      (type === 'TABLE_QR' && !diningTableId) ||
                      (type === 'STATION_QR' && !beautyStationId)
                    }
                  >
                    {pending ? 'Creating…' : 'Create QR'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading}>
                    Refresh workspace
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-teal-900/10 bg-gradient-to-br from-teal-50/45 via-ivory-100/70 to-ivory-100 shadow-card">
            <CardHeader className="border-b border-smoke-400/[0.06]">
              <CardTitle className="text-base">Latest launch pack</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {launchPack ? (
                <>
                  <div className="rounded-2xl border border-smoke-400/[0.06] bg-white/75 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Public ref</p>
                    <p className="mt-2 font-mono text-lg font-semibold text-smoke-400">{launchPack.publicRef}</p>
                    <p className="mt-2 text-sm text-smoke-200">{formatLinkedTarget(launchPack)}</p>
                    <p className="mt-1 text-xs text-smoke-200">{formatScope(launchPack)}</p>
                  </div>

                  <div className="rounded-2xl border border-smoke-400/[0.06] bg-white/75 p-4">
                    <div className="flex items-center gap-2">
                      <Icon icon="logos:whatsapp-icon" className="h-5 w-5" aria-hidden />
                      <p className="text-sm font-semibold text-smoke-400">WhatsApp handoff text</p>
                    </div>
                    <pre className="mt-3 overflow-auto rounded-xl bg-smoke-900 px-3 py-3 font-mono text-xs text-ivory-100">
                      {launchPack.customerLaunch?.prefillText ?? launchPack.rawToken ?? 'No launch text'}
                    </pre>
                    <p className="mt-3 text-xs text-smoke-200">
                      {compactText(
                        launchPack.customerLaunch?.instructions ??
                          'Copy this now. It only returns once after create or rotate.',
                        70,
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-smoke-400/[0.06] bg-white/75 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Deployment URL</p>
                    <p className="mt-2 text-[13px] text-smoke-200">Use this link for print or signage.</p>
                    <pre className="mt-3 overflow-auto rounded-xl bg-ivory-100/90 px-3 py-3 font-mono text-xs text-smoke-400">
                      {launchPageUrl ?? 'Launch URL unavailable until this page is opened in a browser context.'}
                    </pre>
                  </div>

                  {launchPageUrl ? (
                    <div className="rounded-2xl border border-smoke-400/[0.06] bg-white/75 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">Scannable QR</p>
                      <p className="mt-2 text-[13px] text-smoke-200">Ready to print or deploy.</p>
                      <div className="mt-4 flex justify-center">
                        <QrSvg value={launchPageUrl} size={240} className="w-[240px] p-3" />
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {launchPack.customerLaunch?.prefillText ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void copyText(launchPack.customerLaunch!.prefillText, 'WhatsApp text')}
                      >
                        Copy WhatsApp text
                      </Button>
                    ) : null}
                    {launchPack.rawToken ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void copyText(launchPack.rawToken!, 'Raw token')}
                      >
                        Copy raw token
                      </Button>
                    ) : null}
                    {launchPageUrl ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void copyText(launchPageUrl, 'Deployment URL')}
                      >
                        Copy deployment URL
                      </Button>
                    ) : null}
                    {launchPageUrl ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => window.open(launchPageUrl, '_blank', 'noopener,noreferrer')}
                      >
                        Open launch page
                      </Button>
                    ) : null}
                    {launchPack ? (
                      <Button type="button" variant="outline" onClick={() => void printLaunchCard()}>
                        Print deployment card
                      </Button>
                    ) : null}
                    {launchLink ? (
                      <Button type="button" onClick={() => window.open(launchLink, '_blank', 'noopener,noreferrer')}>
                        Open WhatsApp
                      </Button>
                    ) : null}
                  </div>

                  {!launchLink ? (
                    <p className="rounded-xl border border-smoke-400/[0.06] bg-white/70 p-3 text-xs text-smoke-200">
                      Add <span className="font-mono">NEXT_PUBLIC_TIPTAP_WHATSAPP_NUMBER</span> to open direct
                      WhatsApp deep links from this page.
                    </p>
                  ) : null}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-dashed border-smoke-400/15 bg-white/60 p-5">
                    <p className="text-sm font-medium text-smoke-400">No fresh launch pack yet</p>
                    <p className="mt-2 text-[13px] text-smoke-200">Create or rotate a QR to get the latest pack.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-base font-semibold text-smoke-400">All QR codes</h3>
          <Button variant="outline" size="sm" type="button" onClick={() => void refresh()} disabled={loading || !tenantId}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-smoke-200">Loading…</p>
        ) : rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Public ref</Th>
                <Th>Type</Th>
                <Th>Scope</Th>
                <Th>Target</Th>
                <Th>Scans</Th>
                <Th>Last scanned</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className="font-mono text-xs">{r.publicRef}</Td>
                  <Td className="font-mono text-xs">{r.type}</Td>
                  <Td className="text-xs text-smoke-200">{formatScope(r)}</Td>
                  <Td className="text-xs text-smoke-200">{formatLinkedTarget(r)}</Td>
                  <Td>{r.scanCount ?? 0}</Td>
                  <Td className="text-xs text-smoke-200">
                    {r.lastScannedAt ? new Date(r.lastScannedAt).toLocaleString() : '—'}
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" type="button" onClick={() => void onRotate(r.id)} disabled={pending}>
                        Rotate
                      </Button>
                      <Button variant="ghost" size="sm" type="button" onClick={() => void onRevoke(r.id)} disabled={pending}>
                        Revoke
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            icon="ph:qr-code-duotone"
            title="No QR codes yet"
            description="Create your first QR above. TIPTAP will hand you a WhatsApp-ready launch pack immediately."
          />
        )}
      </div>
    </div>
  );
}

export default function QrManagementPage() {
  // Next.js requires useSearchParams() usage to be under a Suspense boundary.
  return (
    <Suspense fallback={<div className="p-6 text-sm text-smoke-200">Loading…</div>}>
      <QrManagementPageInner />
    </Suspense>
  );
}
