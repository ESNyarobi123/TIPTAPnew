'use client';

import Link from 'next/link';
import { Icon } from '@iconify/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { WizardShell, type WizardStep } from '@/components/onboarding/wizard-shell';
import type { BusinessCategory, BusinessSubtype } from '@/lib/onboarding/storage';
import { loadBusinessDraft, saveBusinessDraft } from '@/lib/onboarding/storage';

const steps: WizardStep[] = [
  { key: 'account', label: 'Account', href: '/onboarding/business/account' },
  { key: 'details', label: 'Business details', href: '/onboarding/business/details' },
  { key: 'category', label: 'Category', href: '/onboarding/business/category' },
  { key: 'subtype', label: 'Subtype', href: '/onboarding/business/subtype' },
  { key: 'branch', label: 'First branch', href: '/onboarding/business/branch' },
  { key: 'review', label: 'Review', href: '/onboarding/business/review' },
];

type Tile = { key: BusinessSubtype; title: string; icon: string; desc: string };

const FOOD: Tile[] = [
  { key: 'RESTAURANT', title: 'Restaurant', icon: 'ph:fork-knife-duotone', desc: 'Table flows, menus, bills, waiter calls.' },
  { key: 'CAFE', title: 'Cafe', icon: 'ph:coffee-duotone', desc: 'Fast menus, quick assistance, compact reporting.' },
  { key: 'SEAFOOD', title: 'Seafood place', icon: 'ph:fish-duotone', desc: 'High-volume rooms and staff handoffs.' },
  { key: 'LOUNGE', title: 'Lounge', icon: 'ph:armchair-duotone', desc: 'Premium guest attention and service signals.' },
  { key: 'DINING_BRAND', title: 'Dining brand', icon: 'ph:storefront-duotone', desc: 'Multi-branch visibility and controls.' },
];

const BEAUTY: Tile[] = [
  { key: 'SALON', title: 'Salon', icon: 'ph:scissors-duotone', desc: 'Stations, services, assistance requests.' },
  { key: 'BARBER_SHOP', title: 'Barber shop', icon: 'ph:hair-dryer-duotone', desc: 'Provider-aware flows and tips/ratings.' },
  { key: 'SPA', title: 'Spa', icon: 'ph:flower-lotus-duotone', desc: 'Quiet assistance and treatment cadence.' },
  { key: 'BEAUTY_STUDIO', title: 'Beauty studio', icon: 'ph:sparkle-duotone', desc: 'Services catalog + station context.' },
];

export default function BusinessSubtypeStep() {
  const router = useRouter();
  const [category, setCategory] = useState<BusinessCategory>('FOOD_DINING');
  const [subtype, setSubtype] = useState<BusinessSubtype>('RESTAURANT');

  useEffect(() => {
    const d = loadBusinessDraft();
    setCategory(d.category ?? 'FOOD_DINING');
    if (d.subtype) setSubtype(d.subtype);
  }, []);

  const tiles = useMemo(() => (category === 'BEAUTY_GROOMING' ? BEAUTY : FOOD), [category]);

  function onNext() {
    const d = loadBusinessDraft();
    saveBusinessDraft({ ...d, subtype });
    router.push('/onboarding/business/branch');
  }

  return (
    <WizardShell
      title="Business setup"
      subtitle="Choose a subtype so TIPTAP can shape your default workspace checklists and category tools."
      steps={steps}
      currentKey="subtype"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {tiles.map((t) => {
          const active = t.key === subtype;
          return (
            <motion.button
              key={t.key}
              type="button"
              onClick={() => setSubtype(t.key)}
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
          <Link href="/onboarding/business/category">Back</Link>
        </Button>
      </div>
    </WizardShell>
  );
}

