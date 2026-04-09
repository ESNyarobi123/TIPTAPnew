'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WizardShell, type WizardStep } from '@/components/onboarding/wizard-shell';
import { register } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { setStoredToken, setUserPreview } from '@/lib/auth/storage';
import { loadBusinessDraft, saveBusinessDraft } from '@/lib/onboarding/storage';
import { toast } from '@/lib/toast';

const steps: WizardStep[] = [
  { key: 'account', label: 'Account', href: '/onboarding/business/account' },
  { key: 'details', label: 'Business details', href: '/onboarding/business/details' },
  { key: 'category', label: 'Category', href: '/onboarding/business/category' },
  { key: 'subtype', label: 'Subtype', href: '/onboarding/business/subtype' },
  { key: 'branch', label: 'First branch', href: '/onboarding/business/branch' },
  { key: 'review', label: 'Review', href: '/onboarding/business/review' },
];

export default function BusinessAccountStep() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const d = loadBusinessDraft();
    setFirstName(d.account?.firstName ?? '');
    setLastName(d.account?.lastName ?? '');
    setEmail(d.account?.email ?? '');
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await register({ email, password, firstName, lastName });
      setStoredToken(res.accessToken);
      setUserPreview({ email: res.user?.email, userId: res.user?.id });

      const d = loadBusinessDraft();
      saveBusinessDraft({ ...d, account: { firstName, lastName, email } });
      router.replace('/onboarding/business/details');
      router.refresh();
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not create account');
    } finally {
      setPending(false);
    }
  }

  return (
    <WizardShell
      title="Business setup"
      subtitle="Create your manager account. Then configure your workspace before entering the dashboard."
      steps={steps}
      currentKey="account"
    >
      <Card className="border-smoke-400/10 bg-ivory-50/85 shadow-card">
        <CardContent className="p-6">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="b-first">First name</Label>
                <Input id="b-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-last">Last name</Label>
                <Input id="b-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-email">Email</Label>
              <Input id="b-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-pass">Password</Label>
              <Input id="b-pass" type="password" minLength={10} required value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="text-xs text-smoke-200">Use 10+ characters with upper, lower, and a digit.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? 'Creating…' : 'Continue'}
              </Button>
              <Button type="button" variant="outline" size="lg" asChild className="border-smoke-400/18">
                <Link href="/login">I already have an account</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </WizardShell>
  );
}

