'use client';

import Link from 'next/link';
import { Icon } from '@iconify/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { WizardShell, type WizardStep } from '@/components/onboarding/wizard-shell';
import type { BusinessCategory } from '@/lib/onboarding/storage';
import { loadBusinessDraft, saveBusinessDraft } from '@/lib/onboarding/storage';

const steps: WizardStep[] = [
  { key: 'account', label: 'Account', href: '/onboarding/business/account' },
  { key: 'details', label: 'Business details', href: '/onboarding/business/details' },
  { key: 'category', label: 'Category', href: '/onboarding/business/category' },
  { key: 'subtype', label: 'Subtype', href: '/onboarding/business/subtype' },
  { key: 'branch', label: 'First branch', href: '/onboarding/business/branch' },
  { key: 'review', label: 'Review', href: '/onboarding/business/review' },
];

const CATS: { key: BusinessCategory; title: string; desc: string; icon: string }[] = [
  {
    key: 'FOOD_DINING',
    title: 'Food & Dining',
    desc: 'Tables, menus, waiter calls, bill requests, and dining-native analytics.',
    icon: 'ph:fork-knife-duotone',
  },
  {
    key: 'BEAUTY_GROOMING',
    title: 'Beauty & Grooming',
    desc: 'Stations, service catalog, assistance requests, and provider-aware experiences.',
    icon: 'ph:flower-duotone',
  },
];

export default function BusinessCategoryStep() {
  const router = useRouter();
  const [cat, setCat] = useState<BusinessCategory>('FOOD_DINING');

  useEffect(() => {
    const d = loadBusinessDraft();
    if (d.category) setCat(d.category);
  }, []);

  function onNext() {
    const d = loadBusinessDraft();
    saveBusinessDraft({ ...d, category: cat });
    router.push('/onboarding/business/subtype');
  }

  return (
    <WizardShell
      title="Business setup"
      subtitle="Choose the primary category. TIPTAP will shape your workspace around category-native operations."
      steps={steps}
      currentKey="category"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {CATS.map((c) => {
          const active = c.key === cat;
          return (
            <motion.button
              key={c.key}
              type="button"
              onClick={() => setCat(c.key)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.99 }}
              className="text-left"
            >
              <Card
                className={[
                  'h-full border-smoke-400/10 bg-ivory-50/85 shadow-card transition',
                  active ? 'ring-2 ring-smoke-400/25' : 'hover:shadow-card-hover',
                ].join(' ')}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-smoke-400/[0.06] text-smoke-400 ring-1 ring-smoke-400/[0.05]">
                        <Icon icon={c.icon} className="h-7 w-7" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-display text-lg font-semibold text-smoke-400">{c.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-smoke-200">{c.desc}</p>
                      </div>
                    </div>
                    <span
                      className={[
                        'mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full ring-1',
                        active ? 'bg-smoke-400 text-ivory-100 ring-smoke-400/30' : 'bg-transparent text-transparent ring-smoke-400/20',
                      ].join(' ')}
                      aria-hidden
                    >
                      •
                    </span>
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
          <Link href="/onboarding/business/details">Back</Link>
        </Button>
      </div>
    </WizardShell>
  );
}

