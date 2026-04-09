'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WizardShell, type WizardStep } from '@/components/onboarding/wizard-shell';
import { loadProviderDraft, saveProviderDraft } from '@/lib/onboarding/storage';

const steps: WizardStep[] = [
  { key: 'account', label: 'Account', href: '/onboarding/provider/account' },
  { key: 'type', label: 'Worker type', href: '/onboarding/provider/type' },
  { key: 'profile', label: 'Profile', href: '/onboarding/provider/profile' },
  { key: 'join', label: 'Join a business', href: '/onboarding/provider/join' },
  { key: 'review', label: 'Review', href: '/onboarding/provider/review' },
];

export default function ProviderProfileStep() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [skills, setSkills] = useState('');

  useEffect(() => {
    const d = loadProviderDraft();
    setDisplayName(d.profile?.displayName ?? '');
    setPhone(d.profile?.phone ?? '');
    setSkills(d.profile?.skills ?? '');
  }, []);

  function onNext(e: React.FormEvent) {
    e.preventDefault();
    const d = loadProviderDraft();
    saveProviderDraft({ ...d, profile: { displayName, phone, skills } });
    router.push('/onboarding/provider/join');
  }

  return (
    <WizardShell
      title="Staff / provider setup"
      subtitle="Build a professional profile. This powers tips attribution, ratings visibility, and provider identity."
      steps={steps}
      currentKey="profile"
    >
      <Card className="border-smoke-400/10 bg-ivory-50/85 shadow-card">
        <CardContent className="p-6">
          <form onSubmit={onNext} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pp-name">Display name</Label>
              <Input id="pp-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pp-phone">Phone (optional)</Label>
              <Input id="pp-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pp-skills">Skills / specialization (optional)</Label>
              <Input
                id="pp-skills"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="e.g. Fade, braids, facial, massage…"
              />
              <p className="text-xs text-smoke-200">We’ll structure this into specializations later. For now, keep it readable.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg">
                Continue
              </Button>
              <Button type="button" variant="outline" size="lg" asChild className="border-smoke-400/18">
                <Link href="/onboarding/provider/type">Back</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </WizardShell>
  );
}

