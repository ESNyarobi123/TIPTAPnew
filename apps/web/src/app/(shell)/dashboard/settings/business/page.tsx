'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { SettingsSection } from '@/components/ui/settings-section';
import { ApiError } from '@/lib/api/client';
import { getTenant, updateTenant } from '@/lib/api/tenants-branches';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

export default function BusinessSettingsPage() {
  const { tenantId, refresh } = useScope();
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const token = getStoredToken();
    if (!token || !tenantId) {
      return;
    }
    getTenant(token, tenantId)
      .then((t) => {
        const row = t as Record<string, unknown>;
        setName(String(row.name ?? ''));
        setLegalName(String(row.legalName ?? ''));
        setEmail(String(row.email ?? ''));
        setPhone(String(row.phone ?? ''));
        setLoadErr(null);
      })
      .catch(() => {
        const m = 'Could not load tenant';
        setLoadErr(m);
        toast.error(m);
      });
  }, [tenantId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = getStoredToken();
    if (!token || !tenantId) {
      return;
    }
    setPending(true);
    try {
      await updateTenant(token, tenantId, { name, legalName, email, phone });
      toast.success('Business updated');
      await refresh();
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Update failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        tone="business"
        eyebrow="Organization"
        title="Business"
        description="Legal and contact fields for the active tenant. Updates require the right role assignment."
      />

      {!tenantId ? (
        <EmptyState
          variant="premium"
          icon="ph:buildings-duotone"
          title="Choose a business"
          description="Select a tenant in the header to load and edit organization details."
        />
      ) : (
        <SettingsSection title="Tenant details" className="max-w-lg">
          {loadErr ? (
            <p className="mb-4 text-sm text-smoke-200">Form may be stale — reload the page or pick another tenant.</p>
          ) : null}
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="biz-name">Name</Label>
              <Input id="biz-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-legal">Legal name</Label>
              <Input id="biz-legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-email">Email</Label>
              <Input id="biz-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-phone">Phone</Label>
              <Input id="biz-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </form>
        </SettingsSection>
      )}
    </div>
  );
}
