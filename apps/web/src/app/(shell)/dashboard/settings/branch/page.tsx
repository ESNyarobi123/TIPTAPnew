'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { SettingsSection } from '@/components/ui/settings-section';
import { ApiError } from '@/lib/api/client';
import { getBranch, updateBranch } from '@/lib/api/tenants-branches';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

export default function BranchSettingsPage() {
  const { branchId, refresh } = useScope();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const token = getStoredToken();
    if (!token || !branchId) {
      return;
    }
    getBranch(token, branchId)
      .then((b) => {
        const row = b as Record<string, unknown>;
        setName(String(row.name ?? ''));
        setAddress(String(row.address ?? ''));
        setCity(String(row.city ?? ''));
        setCountry(String(row.country ?? ''));
        setPhone(String(row.phone ?? ''));
        setEmail(String(row.email ?? ''));
        setLoadErr(null);
      })
      .catch(() => {
        const m = 'Could not load branch';
        setLoadErr(m);
        toast.error(m);
      });
  }, [branchId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = getStoredToken();
    if (!token || !branchId) {
      return;
    }
    setPending(true);
    try {
      await updateBranch(token, branchId, { name, address, city, country, phone, email });
      toast.success('Branch updated');
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
        eyebrow="Location"
        title="Branch"
        description="Physical and contact details for the branch selected in the top bar."
      />

      {!branchId ? (
        <EmptyState
          variant="premium"
          icon="ph:map-pin-duotone"
          title="Pick a branch"
          description="Choose a specific branch in the header to edit its profile. Some tenant-wide roles intentionally leave branch unset."
        />
      ) : (
        <SettingsSection title="Branch profile" className="max-w-lg">
          {loadErr ? (
            <p className="mb-4 text-sm text-smoke-200">Form may be stale — reload the page or confirm branch access.</p>
          ) : null}
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="br-name">Name</Label>
              <Input id="br-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="br-addr">Address</Label>
              <Input id="br-addr" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="br-city">City</Label>
                <Input id="br-city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="br-country">Country</Label>
                <Input id="br-country" value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="br-email">Email</Label>
              <Input id="br-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="br-phone">Phone</Label>
              <Input id="br-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
