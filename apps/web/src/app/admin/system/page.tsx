'use client';

import { Icon } from '@iconify/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { SettingsSection } from '@/components/ui/settings-section';
import { ApiError } from '@/lib/api/client';
import { adminSendBotGatewayTestMessage, paymentsTestProviderConfig } from '@/lib/api/admin-tools';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

export default function AdminSystemSettingsPage() {
  const { tenantId } = useScope();
  const [to, setTo] = useState('');
  const [text, setText] = useState('Hello from TIPTAP Admin Command Center.');
  const [sending, setSending] = useState(false);

  const [testingPay, setTestingPay] = useState(false);

  async function sendTest() {
    const token = getStoredToken();
    if (!token) return;
    setSending(true);
    try {
      await adminSendBotGatewayTestMessage(token, { to, text });
      toast.success('Test message sent (queued to bot gateway)');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  async function testPayments() {
    const token = getStoredToken();
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

  if (!getStoredToken()) {
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
        description="Control rails that affect the whole platform: gateway messaging tests, payment credential validation, and core operational switches."
      />

      <SettingsSection
        title="Bot gateway"
        description="Send a WhatsApp test message to confirm the bot gateway is connected and capable of outbound delivery. Secrets stay server-side."
      >
        <Card className="border-smoke-400/10 shadow-soft">
          <CardHeader className="border-b border-smoke-400/[0.06]">
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon icon="logos:whatsapp-icon" className="h-5 w-5" aria-hidden />
              WhatsApp test message
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 pt-5 md:grid-cols-3">
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="bg-to">To (WhatsApp number/JID)</Label>
              <Input
                id="bg-to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="e.g. 2557xxxxxxx@s.whatsapp.net"
              />
              <p className="text-xs text-smoke-200">
                For Baileys, JID format is typically <span className="font-mono">number@s.whatsapp.net</span>.
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="bg-text">Text</Label>
              <Input
                id="bg-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a short message…"
              />
              <div className="pt-1">
                <Button onClick={sendTest} disabled={sending || !to.trim() || !text.trim()} className="shadow-soft">
                  {sending ? 'Sending…' : 'Send test message'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </SettingsSection>

      <SettingsSection
        title="Payments"
        description="Validate tenant ClickPesa credentials by generating a token (no money movement)."
      >
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
                <Icon icon="ph:shield-check-duotone" className="h-5 w-5 text-violet-900/70" aria-hidden />
                Credential test
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
              <div className="text-sm text-smoke-200">
                Tenant: <span className="font-mono text-xs text-smoke-400">{tenantId}</span>
              </div>
              <Button onClick={testPayments} disabled={testingPay} className="shadow-soft">
                {testingPay ? 'Testing…' : 'Test ClickPesa credentials'}
              </Button>
            </CardContent>
          </Card>
        )}
      </SettingsSection>
    </div>
  );
}

