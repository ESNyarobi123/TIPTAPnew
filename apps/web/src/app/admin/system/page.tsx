'use client';

import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { SettingsSection } from '@/components/ui/settings-section';
import { ApiError } from '@/lib/api/client';
import {
  adminGetBotGatewayStatus,
  adminSendBotGatewayTestMessage,
  paymentsTestProviderConfig,
  type BotGatewayStatus,
} from '@/lib/api/admin-tools';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

function toneForGateway(status: BotGatewayStatus | null) {
  if (!status) return 'text-smoke-300';
  if (!status.gatewayReachable) return 'text-rose-500';
  if (status.canSend) return 'text-emerald-500';
  return 'text-amber-500';
}

function labelForGateway(status: BotGatewayStatus | null) {
  if (!status) return 'Checking';
  if (!status.gatewayReachable) return 'Offline';
  if (status.canSend) return 'Ready';
  if (status.whatsappEnabled === false) return 'Disabled';
  return status.connectionState ?? status.bootState ?? 'Booting';
}

export default function AdminSystemSettingsPage() {
  const { tenantId } = useScope();
  const [to, setTo] = useState('');
  const [text, setText] = useState('Hello from TIPTAP Admin Command Center.');
  const [sending, setSending] = useState(false);
  const [gateway, setGateway] = useState<BotGatewayStatus | null>(null);
  const [gatewayLoading, setGatewayLoading] = useState(true);
  const [testingPay, setTestingPay] = useState(false);

  const token = getStoredToken();

  async function loadGatewayStatus(showToast = false) {
    if (!token) return;
    setGatewayLoading(true);
    try {
      const status = await adminGetBotGatewayStatus(token);
      setGateway(status);
      if (showToast) {
        toast.success(status.gatewayReachable ? 'Gateway status refreshed' : 'Gateway still offline');
      }
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Failed to load gateway status';
      setGateway({
        ok: false,
        baseUrl: 'Unknown',
        gatewayReachable: false,
        adminKeyConfigured: false,
        note: message,
      });
      if (showToast) {
        toast.error(message);
      }
    } finally {
      setGatewayLoading(false);
    }
  }

  useEffect(() => {
    void loadGatewayStatus(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendTest() {
    if (!token) return;
    setSending(true);
    try {
      await adminSendBotGatewayTestMessage(token, { to, text });
      toast.success('Test message sent');
      void loadGatewayStatus(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  async function testPayments() {
    if (!token || !tenantId) return;
    setTestingPay(true);
    try {
      const res = await paymentsTestProviderConfig(token, { tenantId });
      toast.success(res?.note ?? 'Payment credentials OK');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Payment test failed');
    } finally {
      setTestingPay(false);
    }
  }

  if (!token) {
    return (
      <EmptyState
        variant="premium"
        icon="ph:lock-key-duotone"
        title="Sign in required"
        description="Sign in to manage platform system settings."
      />
    );
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="platform"
        eyebrow="Command center"
        title="System settings"
        description="Gateway status, test delivery, and payment checks."
      />

      <SettingsSection title="Bot gateway" description="Pair status and outbound test">
        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <Card className="border-smoke-400/10 shadow-soft">
            <CardHeader className="border-b border-smoke-400/[0.06]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon icon="logos:whatsapp-icon" className="h-5 w-5" aria-hidden />
                  WhatsApp gateway
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadGatewayStatus(true)}
                  disabled={gatewayLoading}
                >
                  {gatewayLoading ? 'Refreshing…' : 'Refresh'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-3xl border border-smoke-400/10 bg-white/70 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-smoke-200">
                    <Icon icon="fluent-color:plug-connected-24" className="h-4 w-4" aria-hidden />
                    Gateway
                  </div>
                  <div className={`text-lg font-semibold ${gateway?.gatewayReachable ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {gateway?.gatewayReachable ? 'Online' : 'Offline'}
                  </div>
                  <p className="mt-1 text-xs text-smoke-200">{gateway?.baseUrl ?? 'Loading…'}</p>
                </div>

                <div className="rounded-3xl border border-smoke-400/10 bg-white/70 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-smoke-200">
                    <Icon icon="fluent-color:bot-sparkle-24" className="h-4 w-4" aria-hidden />
                    Channel
                  </div>
                  <div className={`text-lg font-semibold ${gateway?.whatsappEnabled === false ? 'text-amber-600' : 'text-smoke-500'}`}>
                    {gateway?.whatsappEnabled === false ? 'Disabled' : 'Enabled'}
                  </div>
                  <p className="mt-1 text-xs text-smoke-200">Set by `WHATSAPP_ENABLED`</p>
                </div>

                <div className="rounded-3xl border border-smoke-400/10 bg-white/70 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-smoke-200">
                    <Icon icon="fluent-color:flash-checkmark-24" className="h-4 w-4" aria-hidden />
                    Session
                  </div>
                  <div className={`text-lg font-semibold ${toneForGateway(gateway)}`}>
                    {labelForGateway(gateway)}
                  </div>
                  <p className="mt-1 text-xs text-smoke-200">
                    {gateway?.canSend ? 'Ready to send' : 'Pair the WhatsApp account in bot-gateway'}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-smoke-400/10 bg-smoke-50/70 p-4 text-sm text-smoke-300">
                <div className="flex items-start gap-3">
                  <Icon icon="fluent-color:info-24" className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                  <div className="space-y-1">
                    <p className="font-medium text-smoke-500">
                      Sender account comes from the paired WhatsApp session.
                    </p>
                    <p>
                      This form sends a test to a recipient number or JID. It does not register the bot number here.
                    </p>
                    {gateway?.note ? <p className="text-rose-500">{gateway.note}</p> : null}
                    {gateway?.lastError ? <p className="text-rose-500">{gateway.lastError}</p> : null}
                    {!gateway?.gatewayReachable ? (
                      <p className="font-mono text-xs text-smoke-200">
                        docker compose -f infra/docker/docker-compose.yml up --build -d bot-gateway worker
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="bg-to">Recipient</Label>
                  <Input
                    id="bg-to"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="2557xxxxxxx@s.whatsapp.net"
                  />
                  <p className="text-xs text-smoke-200">Use number@s.whatsapp.net for Baileys.</p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="bg-text">Message</Label>
                  <Input
                    id="bg-text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type a short message…"
                  />
                  <div className="pt-1">
                    <Button
                      onClick={sendTest}
                      disabled={
                        sending ||
                        !to.trim() ||
                        !text.trim() ||
                        gatewayLoading ||
                        gateway?.canSend === false
                      }
                      className="shadow-soft"
                    >
                      {sending ? 'Sending…' : 'Send test'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-smoke-400/10 shadow-soft">
            <CardHeader className="border-b border-smoke-400/[0.06]">
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon icon="fluent-color:phone-laptop-24" className="h-5 w-5" aria-hidden />
                Quick view
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5 text-sm text-smoke-300">
              <div className="rounded-3xl border border-smoke-400/10 bg-white/70 p-4">
                <div className="text-xs uppercase tracking-[0.28em] text-smoke-200">Admin key</div>
                <div className={`mt-2 text-base font-semibold ${gateway?.adminKeyConfigured ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {gateway?.adminKeyConfigured ? 'Configured' : 'Missing'}
                </div>
              </div>
              <div className="rounded-3xl border border-smoke-400/10 bg-white/70 p-4">
                <div className="text-xs uppercase tracking-[0.28em] text-smoke-200">Mode</div>
                <div className="mt-2 text-base font-semibold text-smoke-500">{gateway?.channel ?? 'whatsapp'}</div>
              </div>
              <div className="rounded-3xl border border-smoke-400/10 bg-white/70 p-4">
                <div className="text-xs uppercase tracking-[0.28em] text-smoke-200">State</div>
                <div className={`mt-2 text-base font-semibold ${toneForGateway(gateway)}`}>
                  {gateway?.bootState ?? 'loading'}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </SettingsSection>

      <SettingsSection title="Payments" description="Tenant credential check">
        {!tenantId ? (
          <EmptyState
            variant="premium"
            icon="ph:buildings-duotone"
            title="Select a tenant"
            description="Choose a tenant in the header to test its payment credentials."
          />
        ) : (
          <Card className="border-smoke-400/10 shadow-soft">
            <CardHeader className="border-b border-smoke-400/[0.06]">
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon icon="fluent-color:shield-task-24" className="h-5 w-5" aria-hidden />
                Credential test
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
              <div className="text-sm text-smoke-200">
                Tenant: <span className="font-mono text-xs text-smoke-400">{tenantId}</span>
              </div>
              <Button onClick={testPayments} disabled={testingPay} className="shadow-soft">
                {testingPay ? 'Testing…' : 'Test ClickPesa'}
              </Button>
            </CardContent>
          </Card>
        )}
      </SettingsSection>
    </div>
  );
}
