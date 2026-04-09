'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

export default function BusinessDetailsStep() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [phone, setPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    const d = loadBusinessDraft();
    setName(d.business?.name ?? '');
    setBrandName(d.business?.brandName ?? '');
    setPhone(d.business?.phone ?? '');
    setBusinessEmail(d.business?.businessEmail ?? '');
    setCountry(d.business?.country ?? '');
    setCity(d.business?.city ?? '');
    setAddress(d.business?.address ?? '');
  }, []);

  function onNext(e: React.FormEvent) {
    e.preventDefault();
    const d = loadBusinessDraft();
    saveBusinessDraft({
      ...d,
      business: { name, brandName, phone, businessEmail, country, city, address },
    });
    router.push('/onboarding/business/category');
  }

  return (
    <WizardShell
      title="Business setup"
      subtitle="Tell TIPTAP what you’re operating. This shapes category-native workflows and defaults."
      steps={steps}
      currentKey="details"
    >
      <Card className="border-smoke-400/10 bg-ivory-50/85 shadow-card">
        <CardContent className="p-6">
          <form onSubmit={onNext} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="biz-name">Business name</Label>
              <Input id="biz-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-brand">Brand name (optional)</Label>
              <Input id="biz-brand" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="biz-phone">Phone (optional)</Label>
                <Input id="biz-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="biz-email">Business email (optional)</Label>
                <Input id="biz-email" type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="biz-country">Country / region (optional)</Label>
                <Input id="biz-country" value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="biz-city">City (optional)</Label>
                <Input id="biz-city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-address">Address (optional)</Label>
              <Input id="biz-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg">
                Continue
              </Button>
              <Button type="button" variant="outline" size="lg" asChild className="border-smoke-400/18">
                <Link href="/onboarding/business/account">Back</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </WizardShell>
  );
}

