'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WizardShell, type WizardStep } from '@/components/onboarding/wizard-shell';
import { ApiError } from '@/lib/api/client';
import { redeemStaffJoinInvite } from '@/lib/api/staff';
import { getStoredToken } from '@/lib/auth/storage';
import { loadProviderDraft, saveProviderDraft } from '@/lib/onboarding/storage';

const steps: WizardStep[] = [
  { key: 'account', label: 'Account', href: '/onboarding/provider/account' },
  { key: 'type', label: 'Worker type', href: '/onboarding/provider/type' },
  { key: 'profile', label: 'Profile', href: '/onboarding/provider/profile' },
  { key: 'join', label: 'Join a business', href: '/onboarding/provider/join' },
  { key: 'review', label: 'Review', href: '/onboarding/provider/review' },
];

export default function ProviderJoinStep() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [connectLater, setConnectLater] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const d = loadProviderDraft();
    setJoinCode(d.join?.joinCode ?? '');
    setConnectLater(Boolean(d.join?.connectLater));
  }, []);

  async function onNext(e: React.FormEvent) {
    e.preventDefault();
    const d = loadProviderDraft();
    const trimmed = joinCode.trim();

    if (connectLater || !trimmed) {
      saveProviderDraft({ ...d, join: { joinCode: trimmed, connectLater } });
      router.push('/onboarding/provider/review');
      return;
    }

    const token = getStoredToken();
    if (!token) {
      toast.error('Sign in again to redeem a join code.');
      router.push(`/login?next=${encodeURIComponent('/onboarding/provider/join')}`);
      return;
    }

    setPending(true);
    try {
      const res = await redeemStaffJoinInvite(token, trimmed);
      saveProviderDraft({
        ...d,
        join: { joinCode: trimmed, connectLater: false },
      });
      toast.success(
        `Linked to ${res.tenant.name} · ${res.branch.name}${res.consumedInvite ? '' : ' (already linked to this branch)'}`,
      );
      router.push('/onboarding/provider/review');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not redeem join code');
    } finally {
      setPending(false);
    }
  }

  return (
    <WizardShell
      title="Staff / provider setup"
      subtitle="Join a business using an invite/join code from your manager, or connect later."
      steps={steps}
      currentKey="join"
    >
      <Card className="border-smoke-400/10 bg-ivory-50/85 shadow-card">
        <CardContent className="p-6">
          <form onSubmit={(e) => void onNext(e)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pj-code">Join / invite code (optional)</Label>
              <Input
                id="pj-code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="e.g. TT-AB12CD34"
                disabled={connectLater || pending}
                autoComplete="off"
              />
              <p className="text-xs text-smoke-200">
                Ask your manager for a code from <span className="font-medium text-smoke-300">Staff &amp; providers</span> in
                the business dashboard. You must complete your profile step first. Hyphens are optional.
              </p>
            </div>
            <label className="flex items-start gap-3 rounded-2xl border border-smoke-400/[0.06] bg-ivory-100/60 px-4 py-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-smoke-400/20 accent-smoke-400"
                checked={connectLater}
                disabled={pending}
                onChange={(e) => setConnectLater(e.target.checked)}
              />
              <span>
                <span className="font-medium text-smoke-400">I’ll connect later</span>
                <span className="block text-xs leading-relaxed text-smoke-200">
                  You can still enter your provider workspace. Once a manager links you to a tenant/branch, your tips and
                  requests will appear.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? 'Linking…' : 'Continue'}
              </Button>
              <Button type="button" variant="outline" size="lg" asChild className="border-smoke-400/18" disabled={pending}>
                <Link href="/onboarding/provider/profile">Back</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </WizardShell>
  );
}
