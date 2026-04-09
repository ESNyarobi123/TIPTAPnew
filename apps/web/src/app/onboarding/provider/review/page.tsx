'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WizardShell, type WizardStep } from '@/components/onboarding/wizard-shell';
import { ApiError } from '@/lib/api/client';
import { upsertMyProviderProfile } from '@/lib/api/provider-registry';
import { clearProviderDraft, loadProviderDraft } from '@/lib/onboarding/storage';
import { getStoredToken } from '@/lib/auth/storage';
import { replaceToWorkspaceFromToken } from '@/lib/auth/workspace';
import { toast } from '@/lib/toast';

const steps: WizardStep[] = [
  { key: 'account', label: 'Account', href: '/onboarding/provider/account' },
  { key: 'type', label: 'Worker type', href: '/onboarding/provider/type' },
  { key: 'profile', label: 'Profile', href: '/onboarding/provider/profile' },
  { key: 'join', label: 'Join a business', href: '/onboarding/provider/join' },
  { key: 'review', label: 'Review', href: '/onboarding/provider/review' },
];

export default function ProviderReviewStep() {
  const router = useRouter();
  const draft = useMemo(() => loadProviderDraft(), []);
  const [pending, setPending] = useState(false);

  async function finish() {
    setPending(true);
    try {
      const t = getStoredToken();
      if (t) {
        const skills = (draft.profile?.skills ?? '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
        const profile = await upsertMyProviderProfile(t, {
          displayName: draft.profile?.displayName || undefined,
          headline:
            draft.type === 'PROVIDER'
              ? 'Independent provider on TIPTAP'
              : 'Staff profile on TIPTAP',
          bio: draft.join?.connectLater
            ? 'Available for future assignments across businesses using TIPTAP.'
            : 'Open to active business linking inside TIPTAP.',
          skills,
        });
        clearProviderDraft();
        if (profile.registryCode) {
          toast.success(`Provider profile created. Your code: ${profile.registryCode}`);
        } else {
          toast.success('Provider profile saved');
        }
        await replaceToWorkspaceFromToken(router, t);
      } else {
        toast.info('Please sign in to continue.');
        router.replace('/login');
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save provider profile');
    } finally {
      setPending(false);
    }
  }

  return (
    <WizardShell
      title="Staff / provider setup"
      subtitle="Review your profile and enter your workspace. Linking to a business can happen now or later."
      steps={steps}
      currentKey="review"
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-smoke-400/10 bg-ivory-50/85 shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-smoke-400/[0.06] bg-ivory-100/60 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-smoke-200">Worker type</p>
              <p className="mt-2 font-mono text-sm text-smoke-400">{draft.type ?? '—'}</p>
            </div>
            <div className="rounded-2xl border border-smoke-400/[0.06] bg-ivory-100/60 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-smoke-200">Display name</p>
              <p className="mt-2 font-display text-lg font-semibold text-smoke-400">{draft.profile?.displayName ?? '—'}</p>
              <p className="mt-1 text-sm text-smoke-200">{draft.profile?.skills ?? '—'}</p>
            </div>
            <div className="rounded-2xl border border-smoke-400/[0.06] bg-ivory-100/60 p-4 md:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-smoke-200">Join</p>
              <p className="mt-2 text-sm text-smoke-200">
                {draft.join?.connectLater
                  ? 'Connect later'
                  : draft.join?.joinCode
                    ? `Join code: ${draft.join.joinCode}`
                    : 'Not set'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-smoke-400/10 bg-ivory-50/85 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Enter workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button type="button" size="lg" className="w-full" disabled={pending} onClick={() => void finish()}>
              {pending ? 'Entering…' : 'Enter provider workspace'}
            </Button>
            <p className="text-xs leading-relaxed text-smoke-200">
              TIPTAP will save your portable provider identity now and generate a global provider code that managers can use to link you into businesses later.
            </p>
            <Button variant="outline" size="sm" asChild className="border-smoke-400/18">
              <Link href="/onboarding/provider/join">Back</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </WizardShell>
  );
}
