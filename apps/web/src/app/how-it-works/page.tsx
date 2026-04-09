'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';

const ease = [0.22, 1, 0.36, 1] as const;

const steps = [
  {
    title: 'Scan QR',
    body: 'A QR code anchors context: business, branch, table/station, and optional staff host.',
    icon: 'ph:qr-code-duotone',
  },
  {
    title: 'Start WhatsApp journey',
    body: 'Guests interact without an app: menu/services, assistance, bill requests, tips, and ratings.',
    icon: 'logos:whatsapp-icon',
  },
  {
    title: 'Capture operational events',
    body: 'Requests become structured records: waiter calls, bill requests, assistance queues — audit-backed.',
    icon: 'ph:clipboard-text-duotone',
  },
  {
    title: 'Surface signals in dashboards',
    body: 'Managers see payment health, tips sentiment, ratings, and category-native operations by scope.',
    icon: 'ph:gauge-duotone',
  },
  {
    title: 'Reconcile + produce statements',
    body: 'Transactions, webhooks, and reconciliation flags roll into statements for finance-ready visibility.',
    icon: 'ph:scales-duotone',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-ivory-100 text-smoke-400 selection:bg-smoke-400/20">
      <header className="sticky top-0 z-30 border-b border-smoke-400/[0.07] bg-ivory-100/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="group flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-smoke-400 text-sm text-ivory-100 shadow-soft transition group-hover:bg-smoke-300">
              T
            </span>
            TIPTAP
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Button variant="outline" size="sm" asChild className="border-smoke-400/18">
              <Link href="/get-started">Get started</Link>
            </Button>
            <Button size="sm" asChild className="shadow-soft">
              <Link href="/login">Sign in</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease }}>
          <SectionHeader
            eyebrow="How it works"
            title="A single operational narrative — from scan to settlement"
            description="TIPTAP keeps guest intent, operations, and finance aligned with QR-grounded sessions and role-aware workspaces."
            action={
              <Button size="lg" asChild className="shadow-card">
                <Link href="/get-started">Choose your path</Link>
              </Button>
            }
          />

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, ease, delay: i * 0.04 }}
              >
                <Card interactive className="h-full border-smoke-400/10 bg-ivory-50/80 shadow-card">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-smoke-400/[0.06] text-smoke-400 ring-1 ring-smoke-400/[0.05]">
                          <Icon icon={s.icon} className="h-6 w-6" aria-hidden />
                        </div>
                        <h3 className="font-display text-lg font-semibold text-smoke-400">{s.title}</h3>
                      </div>
                      <span className="font-mono text-xs text-smoke-200">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-smoke-200">{s.body}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="mt-14 rounded-[1.5rem] border border-smoke-400/10 bg-smoke-400 p-10 text-ivory-100 shadow-card-hover">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ivory-200/85">Key idea</p>
            <p className="mt-4 font-display text-2xl font-semibold leading-snug">
              TIPTAP is not “a dashboard” — it’s a role-aware operating system.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ivory-200/95">
              Managers operate businesses with category-native tools. Staff focus on work signals and earnings. Super Admins observe platform health.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button size="lg" variant="secondary" asChild className="bg-ivory-100 text-smoke-400 shadow-soft">
                <Link href="/get-started">Start onboarding</Link>
              </Button>
              <Button size="lg" variant="ghost" asChild className="text-ivory-200 hover:bg-ivory-100/[0.08]">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

