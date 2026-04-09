'use client';

import Link from 'next/link';
import { Icon } from '@iconify/react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { KeyValueList } from '@/components/ui/key-value-list';
import { MetricMini } from '@/components/ui/metric-mini';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { SettingsSection } from '@/components/ui/settings-section';
import { StatusChip } from '@/components/ui/status-chip';
import { StructuredObject } from '@/components/ui/structured-object';
import { Table, Td, Th } from '@/components/ui/table';
import { ApiError } from '@/lib/api/client';
import { paymentsRecentTransactions } from '@/lib/api/payments-dashboard';
import { paymentsTestProviderConfig } from '@/lib/api/payments-tools';
import { listProviderConfigs, upsertProviderConfig } from '@/lib/api/tenants-branches';
import { getStoredToken } from '@/lib/auth/storage';
import { formatMinorUnits } from '@/lib/format';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

type MaskedConfig = {
  id?: string;
  provider?: string;
  displayName?: string;
  isActive?: boolean;
  collectionEnabled?: boolean;
  payoutEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastWebhookAt?: string | null;
  settings?: unknown;
  credentialsPreview?: {
    clientId?: string;
    apiKey?: string;
    checksumKeySet?: boolean;
    webhookSecretSet?: boolean;
  } | null;
};

type RecentTxn = {
  id: string;
  orderReference?: string;
  type?: string;
  status?: string;
  amountCents?: number;
  createdAt?: string;
};

function asRecentTxn(value: unknown): RecentTxn | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : '';
  if (!id) {
    return null;
  }
  return {
    id,
    orderReference: typeof record.orderReference === 'string' ? record.orderReference : undefined,
    type: typeof record.type === 'string' ? record.type : undefined,
    status: typeof record.status === 'string' ? record.status : undefined,
    amountCents: typeof record.amountCents === 'number' ? record.amountCents : undefined,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
  };
}

export default function PaymentConfigSettingsPage() {
  const { tenantId } = useScope();
  const [configs, setConfigs] = useState<MaskedConfig[]>([]);
  const [recentTxns, setRecentTxns] = useState<RecentTxn[]>([]);
  const [clientId, setClientId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [checksumKey, setChecksumKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [testNote, setTestNote] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [testing, setTesting] = useState(false);

  async function refreshAll() {
    const token = getStoredToken();
    if (!token || !tenantId) {
      setConfigs([]);
      setRecentTxns([]);
      return;
    }
    try {
      const [configPayload, recentPayload] = await Promise.all([
        listProviderConfigs(token, tenantId),
        paymentsRecentTransactions(token, { tenantId, page: 1, pageSize: 8 }),
      ]);
      setConfigs(Array.isArray(configPayload) ? (configPayload as MaskedConfig[]) : []);
      const items =
        recentPayload && typeof recentPayload === 'object' && 'items' in recentPayload
          ? (recentPayload as { items?: unknown[] }).items
          : [];
      setRecentTxns((Array.isArray(items) ? items : []).map(asRecentTxn).filter((row): row is RecentTxn => Boolean(row)));
    } catch {
      toast.error('Could not load payment workspace');
    }
  }

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const activeCount = useMemo(() => configs.filter((config) => config.isActive).length, [configs]);
  const webhookReadyCount = useMemo(
    () => configs.filter((config) => config.credentialsPreview?.webhookSecretSet).length,
    [configs],
  );
  const collectionReadyCount = useMemo(
    () => configs.filter((config) => config.collectionEnabled).length,
    [configs],
  );
  const latestWebhookAt = useMemo(() => {
    const values = configs
      .map((config) => config.lastWebhookAt)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .sort();
    return values.at(-1) ?? null;
  }, [configs]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const token = getStoredToken();
    if (!token || !tenantId) {
      return;
    }
    setPending(true);
    try {
      await upsertProviderConfig(token, {
        tenantId,
        clientId,
        apiKey,
        checksumKey: checksumKey || undefined,
        webhookSecret: webhookSecret || undefined,
        displayName: 'ClickPesa',
      });
      toast.success('Provider configuration saved');
      setApiKey('');
      setWebhookSecret('');
      setChecksumKey('');
      setTestNote(null);
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Save failed');
    } finally {
      setPending(false);
    }
  }

  async function onTest() {
    const token = getStoredToken();
    if (!token || !tenantId) return;
    setTesting(true);
    try {
      const result = await paymentsTestProviderConfig(token, { tenantId });
      const note = result?.note ?? 'Credentials valid';
      setTestNote(note);
      toast.success(note);
    } catch (error) {
      setTestNote(null);
      toast.error(error instanceof ApiError ? error.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="business"
        eyebrow="Finance setup"
        title="Payment control"
        description="Keep merchant payment rails clean and trustworthy. TIPTAP encrypts live credentials at rest, shows only masked previews, and keeps the manager close to health, recent activity, and webhook readiness."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/payments">Open payments workspace</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/statements">View statements</Link>
            </Button>
          </div>
        }
      />

      {!tenantId ? (
        <EmptyState
          variant="premium"
          icon="ph:buildings-duotone"
          title="Select a tenant"
          description="Choose an organization in the header to configure payment rails for that business."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricMini icon="ph:plug-duotone" label="Active rails" value={activeCount} hint="Provider rows marked active" />
            <MetricMini icon="ph:shield-check-duotone" label="Webhook ready" value={webhookReadyCount} hint="Secrets configured" />
            <MetricMini icon="ph:wallet-duotone" label="Collections ready" value={collectionReadyCount} hint="Providers with collection enabled" />
            <MetricMini
              icon="ph:heartbeat-duotone"
              label="Latest heartbeat"
              value={latestWebhookAt ? new Date(latestWebhookAt).toLocaleDateString() : '—'}
              hint={latestWebhookAt ? new Date(latestWebhookAt).toLocaleTimeString() : 'No webhook yet'}
            />
          </div>

          <Card className="border-smoke-400/10 bg-gradient-to-br from-ivory-100 via-ivory-50 to-emerald-50/30 shadow-card">
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)] lg:p-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Merchant payment model</p>
                <h2 className="mt-2 font-display text-xl font-semibold text-smoke-400">One TIPTAP system, separate merchant credentials</h2>
                <p className="mt-3 text-[13px] text-smoke-200">
                  Each business keeps its own keys, so collections and payouts never mix.
                </p>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-smoke-400/10 bg-white/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Safe handling</p>
                  <div className="mt-3 space-y-2 text-sm text-smoke-300">
                    <div>1. Save keys only from trusted finance roles.</div>
                    <div>2. Run a connection test after rotation.</div>
                    <div>3. Watch recent ledger rows and webhook freshness.</div>
                  </div>
                </div>
                {testNote ? (
                  <div className="rounded-2xl border border-emerald-900/10 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950">
                    <div className="flex items-start gap-2">
                      <Icon icon="ph:check-circle-duotone" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span>{testNote}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <SettingsSection
            title="Recent ledger"
            description="Latest payment rows in this scope."
          >
            {recentTxns.length ? (
              <Card className="border-smoke-400/10 shadow-soft">
                <CardContent className="pt-5">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Reference</Th>
                        <Th>Type</Th>
                        <Th>Status</Th>
                        <Th className="text-right">Amount</Th>
                        <Th>Created</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTxns.map((txn) => (
                        <tr key={txn.id}>
                          <Td className="font-mono text-xs text-smoke-300">{txn.orderReference ?? txn.id.slice(0, 8)}</Td>
                          <Td className="text-sm text-smoke-300">{txn.type ? txn.type.replace(/_/g, ' ') : '—'}</Td>
                          <Td>{txn.status ? <StatusChip status={txn.status} /> : '—'}</Td>
                          <Td className="text-right tabular-nums">{formatMinorUnits(txn.amountCents ?? 0)}</Td>
                          <Td className="text-xs text-smoke-200">
                            {txn.createdAt ? new Date(txn.createdAt).toLocaleString() : '—'}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <EmptyState
                className="border-none bg-ivory-50/50 py-10"
                icon="ph:receipt-duotone"
                title="No recent transactions yet"
                description="Recent rows will show here."
              />
            )}
          </SettingsSection>

          <SettingsSection
            title="Active integrations"
            description="Configured providers and status."
          >
            {configs.length === 0 ? (
              <EmptyState
                className="border-none bg-ivory-50/50 py-10"
                icon="ph:plug-duotone"
                title="No provider configured yet"
                description="Add credentials to go live."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {configs.map((config) => (
                  <Card key={config.id ?? config.provider} className="border-smoke-400/10 shadow-soft">
                    <CardHeader className="border-b border-smoke-400/[0.06] pb-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <CardTitle className="font-display text-base">
                          {config.displayName ?? config.provider ?? 'Provider'}
                        </CardTitle>
                        <div className="flex flex-wrap gap-2">
                          {config.isActive ? <StatusChip status="ACTIVE" /> : <StatusChip status="INACTIVE" />}
                          {config.collectionEnabled ? (
                            <span className="rounded-full bg-smoke-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-smoke-300">
                              Collections on
                            </span>
                          ) : null}
                          {config.payoutEnabled ? (
                            <span className="rounded-full bg-smoke-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-smoke-300">
                              Payouts on
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <p className="text-xs font-medium uppercase tracking-wide text-smoke-200">
                        {config.provider ?? '—'}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-5">
                      <KeyValueList
                        rows={[
                          { label: 'Client ID (masked)', value: config.credentialsPreview?.clientId ?? '—' },
                          { label: 'API key (masked)', value: config.credentialsPreview?.apiKey ?? '—' },
                          {
                            label: 'Checksum key',
                            value: config.credentialsPreview?.checksumKeySet ? 'Configured' : 'Not set',
                          },
                          {
                            label: 'Webhook secret',
                            value: config.credentialsPreview?.webhookSecretSet ? 'Configured' : 'Not set',
                          },
                          {
                            label: 'Last webhook',
                            value: config.lastWebhookAt ? new Date(config.lastWebhookAt).toLocaleString() : 'No heartbeat recorded',
                          },
                          {
                            label: 'Updated',
                            value: config.updatedAt ? new Date(config.updatedAt).toLocaleString() : '—',
                          },
                        ]}
                      />
                      {config.settings != null && typeof config.settings === 'object' ? (
                        <div>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-smoke-200">
                            Provider settings
                          </p>
                          <StructuredObject value={config.settings} />
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </SettingsSection>

          <SettingsSection
            title="Configure ClickPesa"
            description="Creates or replaces the encrypted merchant credential bundle. Secrets are never echoed back after save."
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <Card className="border-smoke-400/10 shadow-soft">
                <CardHeader className="border-b border-smoke-400/[0.06] pb-4">
                  <CardTitle className="text-base">Save merchant credentials</CardTitle>
                </CardHeader>
                <CardContent className="pt-5">
                  <form onSubmit={onSubmit} className="space-y-5">
                    <div className="rounded-xl border border-amber-900/10 bg-amber-50/35 px-4 py-3 text-sm text-amber-950">
                      <div className="flex gap-2">
                        <Icon icon="ph:shield-warning-duotone" className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                        <p>
                          Only trusted finance and engineering roles should handle live keys. Mis-typed credentials may block guest payments until corrected.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pc-client">Client ID</Label>
                      <Input id="pc-client" value={clientId} onChange={(event) => setClientId(event.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pc-key">API key</Label>
                      <Input
                        id="pc-key"
                        type="password"
                        autoComplete="off"
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pc-checksum">Checksum key</Label>
                      <Input id="pc-checksum" value={checksumKey} onChange={(event) => setChecksumKey(event.target.value)} placeholder="Optional" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pc-wh">Webhook secret</Label>
                      <Input
                        id="pc-wh"
                        type="password"
                        autoComplete="off"
                        value={webhookSecret}
                        onChange={(event) => setWebhookSecret(event.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" disabled={pending} className="shadow-soft">
                        {pending ? 'Saving…' : 'Save provider config'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={pending || testing || !configs.length}
                        onClick={() => void onTest()}
                      >
                        {testing ? 'Testing…' : 'Test credentials'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-smoke-400/10 bg-ivory-50/85 shadow-soft">
                <CardHeader className="border-b border-smoke-400/[0.06] pb-4">
                  <CardTitle className="text-base">Manager checklist</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-5 text-sm text-smoke-300">
                  <div className="rounded-2xl border border-smoke-400/10 bg-white/70 p-4">
                    <p className="font-medium text-smoke-400">Before going live</p>
                    <div className="mt-3 space-y-2">
                      <div>1. Confirm the right merchant account and provider mode.</div>
                      <div>2. Set a webhook secret for safer status updates.</div>
                      <div>3. Run a connection test before the first guest payment.</div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-smoke-400/10 bg-white/70 p-4">
                    <p className="font-medium text-smoke-400">After launch</p>
                    <div className="mt-3 space-y-2">
                      <div>1. Watch pending and failed rows in the payments workspace.</div>
                      <div>2. Use statements for finance review and payout alignment.</div>
                      <div>3. Reconcile suspicious rows before they become support noise.</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </SettingsSection>
        </>
      )}
    </div>
  );
}
