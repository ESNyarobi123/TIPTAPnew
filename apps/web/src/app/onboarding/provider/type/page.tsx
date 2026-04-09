'use client';

import Link from 'next/link';
import { Icon } from '@iconify/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { WizardShell, type WizardStep } from '@/components/onboarding/wizard-shell';
import { loadProviderDraft, saveProviderDraft } from '@/lib/onboarding/storage';

const steps: WizardStep[] = [
  { key: 'account', label: 'Account', href: '/onboarding/provider/account' },
  { key: 'type', label: 'Worker type', href: '/onboarding/provider/type' },
  { key: 'profile', label: 'Profile', href: '/onboarding/provider/profile' },
  { key: 'join', label: 'Join a business', href: '/onboarding/provider/join' },
  { key: 'review', label: 'Review', href: '/onboarding/provider/review' },
];

export default function ProviderTypeStep() {
  const router = useRouter();
  const [kind, setKind] = useState<'STAFF' | 'PROVIDER'>('STAFF');

  useEffect(() => {
    const d = loadProviderDraft();
    if (d.type) setKind(d.type);
  }, []);

  function onNext() {
    const d = loadProviderDraft();
    saveProviderDraft({ ...d, type: kind });
    router.push('/onboarding/provider/profile');
  }

  return (
    <WizardShell
      title="Staff / provider setup"
      subtitle="This determines the tone of your workspace: staff tasks vs provider performance and reputation."
      steps={steps}
      currentKey="type"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            k: 'STAFF' as const,
            title: 'Staff',
            icon: 'ph:users-three-duotone',
            desc: 'Waiter/attendant/front desk roles with request queues and shift context.',
          },
          {
            k: 'PROVIDER' as const,
            title: 'Service Provider',
            icon: 'ph:identification-badge-duotone',
            desc: 'Barber/stylist/therapist roles with tips, ratings, specializations, and portable profile.',
          },
        ].map((t) => {
          const active = kind === t.k;
          return (
            <motion.button
              key={t.k}
              type="button"
              onClick={() => setKind(t.k)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.99 }}
              className="text-left"
            >
              <Card className={['h-full border-smoke-400/10 bg-ivory-50/85 shadow-card transition', active ? 'ring-2 ring-smoke-400/25' : 'hover:shadow-card-hover'].join(' ')}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-smoke-400/[0.06] text-smoke-400 ring-1 ring-smoke-400/[0.05]">
                      <Icon icon={t.icon} className="h-7 w-7" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-semibold text-smoke-400">{t.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-smoke-200">{t.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button type="button" size="lg" onClick={onNext}>
          Continue
        </Button>
        <Button type="button" variant="outline" size="lg" asChild className="border-smoke-400/18">
          <Link href="/onboarding/provider/account">Back</Link>
        </Button>
      </div>
    </WizardShell>
  );
}

