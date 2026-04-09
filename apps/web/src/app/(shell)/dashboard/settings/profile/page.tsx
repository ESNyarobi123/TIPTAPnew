'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { SettingsSection } from '@/components/ui/settings-section';
import { ApiError } from '@/lib/api/client';
import { getUser, updateUser } from '@/lib/api/tenants-branches';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

export default function ProfileSettingsPage() {
  const { me, refresh } = useScope();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const token = getStoredToken();
    if (!token || !me?.id) {
      return;
    }
    getUser(token, me.id)
      .then((u) => {
        const row = u as Record<string, unknown>;
        setFirstName(String(row.firstName ?? ''));
        setLastName(String(row.lastName ?? ''));
        setPhone(String(row.phone ?? ''));
      })
      .catch(() => {
        setFirstName(me.firstName ?? '');
        setLastName(me.lastName ?? '');
        setPhone(me.phone ?? '');
      });
  }, [me?.id, me?.firstName, me?.lastName, me?.phone]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = getStoredToken();
    if (!token || !me?.id) {
      return;
    }
    setPending(true);
    try {
      await updateUser(token, me.id, { firstName, lastName, phone });
      toast.success('Profile updated');
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
        eyebrow="Account"
        title="Profile"
        description="Personal details — saved through the users API and reflected across your workspace session."
      />
      <SettingsSection
        title={me?.email ?? 'Your profile'}
        description="Name and phone are optional but recommended for support and receipts."
        className="max-w-lg"
      >
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fn">First name</Label>
              <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ln">Last name</Label>
              <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ph">Phone</Label>
            <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </SettingsSection>
    </div>
  );
}
