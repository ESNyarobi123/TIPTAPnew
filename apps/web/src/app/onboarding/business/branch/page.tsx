'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WizardShell, type WizardStep } from '@/components/onboarding/wizard-shell';
import { loadBusinessDraft, saveBusinessDraft } from '@/lib/onboarding/storage';

const steps: WizardStep[] = [
  { key: 'account', label: 'Account', href: '/onboarding/business/account' },
  { key: 'details', label: 'Business details', href: '/onboarding/business/details' },
  { key: 'category', label: 'Category', href: '/onboarding/business/category' },
  { key: 'subtype', label: 'Subtype', href: '/onboarding/business/subtype' },
  { key: 'branch', label: 'First branch', href: '/onboarding/business/branch' },
  { key: 'review', label: 'Review', href: '/onboarding/business/review' },
];

export default function BusinessBranchStep() {
  const router = useRouter();
  const [name, setName] = useState('Main');
  const [code, setCode] = useState('MAIN');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [timezone, setTimezone] = useState('');

  useEffect(() => {
    const d = loadBusinessDraft();
    setName(d.branch?.name ?? 'Main');
    setCode(d.branch?.code ?? 'MAIN');
    setAddress(d.branch?.address ?? '');
    setCity(d.branch?.city ?? '');
    setCountry(d.branch?.country ?? '');
    setPhone(d.branch?.phone ?? '');
    setEmail(d.branch?.email ?? '');
    setTimezone(d.branch?.timezone ?? '');
  }, []);

  function onNext(e: React.FormEvent) {
    e.preventDefault();
    const d = loadBusinessDraft();
    saveBusinessDraft({
      ...d,
      branch: { name, code, address, city, country, phone, email, timezone },
    });
    router.push('/onboarding/business/review');
  }

  return (
    <WizardShell
      title="Business setup"
      subtitle="Create the first branch. Branch scope powers QR context, operations queues, and analytics filtering."
      steps={steps}
      currentKey="branch"
    >
      <Card className="border-smoke-400/10 bg-ivory-50/85 shadow-card">
        <CardContent className="p-6">
          <form onSubmit={onNext} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="br-name">Branch name</Label>
                <Input id="br-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="br-code">Branch code</Label>
                <Input id="br-code" value={code} onChange={(e) => setCode(e.target.value)} required />
                <p className="text-xs text-smoke-200">Stable code within your tenant (e.g. MAIN, DSM, ZNZ).</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="br-address">Address (optional)</Label>
              <Input id="br-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="br-city">City (optional)</Label>
                <Input id="br-city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="br-country">Country (optional)</Label>
                <Input id="br-country" value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="br-phone">Primary phone (optional)</Label>
                <Input id="br-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="br-email">Branch email (optional)</Label>
                <Input id="br-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="br-tz">Timezone (optional)</Label>
              <Input id="br-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="e.g. Africa/Dar_es_Salaam" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg">
                Continue
              </Button>
              <Button type="button" variant="outline" size="lg" asChild className="border-smoke-400/18">
                <Link href="/onboarding/business/subtype">Back</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </WizardShell>
  );
}

