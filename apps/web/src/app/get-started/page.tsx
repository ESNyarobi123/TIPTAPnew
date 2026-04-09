'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ease = [0.22, 1, 0.36, 1] as const;

const paths = [
  {
    icon: 'ph:buildings-duotone',
    title: 'Manager / owner',
    description: 'For people setting up the business, staff, categories, payments, QR, and control-room analytics.',
    bullets: ['Create business and branch', 'Choose restaurant or beauty category', 'Start QR, WhatsApp, and finance setup'],
    href: '/onboarding/business/account',
    cta: 'Start manager onboarding',
    accent: 'from-amber-50 via-ivory-100 to-amber-100/50',
  },
  {
    icon: 'ph:identification-badge-duotone',
    title: 'Staff / provider',
    description: 'For waiters, stylists, barbers, therapists, and service teams who need a personal work dashboard.',
    bullets: ['Create your account and profile', 'Get linked by a manager', 'Track assignments, tips, and ratings'],
    href: '/onboarding/provider/account',
    cta: 'Start staff onboarding',
    accent: 'from-teal-50 via-ivory-100 to-teal-100/45',
  },
  {
    icon: 'ph:lock-key-open-duotone',
    title: 'Already inside TIPTAP',
    description: 'If your account already exists, sign in and TIPTAP routes you into the workspace your role allows.',
    bullets: ['Manager dashboards', 'Staff workspace', 'Role-safe sign-in'],
    href: '/login',
    cta: 'Sign in',
    accent: 'from-smoke-400/[0.05] via-ivory-100 to-ivory-50',
  },
];

export default function GetStartedPage() {
  return (
    <div className="min-h-screen bg-[#f5efe3] text-smoke-400">
      <header className="sticky top-0 z-30 border-b border-smoke-400/[0.07] bg-[#f8f3e9]/84 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="group flex items-center gap-3 font-display text-lg font-semibold tracking-tight">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-smoke-400 text-sm text-ivory-100 shadow-soft transition group-hover:bg-smoke-300">
              T
            </span>
            TIPTAP
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="outline" size="sm" asChild className="border-smoke-400/18">
              <Link href="/how-it-works">How it works</Link>
            </Button>
            <Button size="sm" asChild className="shadow-soft">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease }}
          className="space-y-10"
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-smoke-400/10 bg-ivory-50/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-smoke-200 shadow-soft">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600/85" aria-hidden />
                Entry architecture
              </div>
              <h1 className="font-display text-[2.35rem] font-semibold leading-[1.03] tracking-tight md:text-[3.45rem]">
                Choose the TIPTAP path that matches your real job.
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-smoke-200 md:text-[15px]">
                The platform should feel organized before onboarding even starts. Managers enter business setup.
                Staff enter a personal work path. Existing users go straight into secure sign-in.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Manager setup', 'Business first'],
                ['Staff setup', 'Profile first'],
                ['Returning users', 'Secure sign in'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[1.35rem] border border-smoke-400/[0.08] bg-ivory-50/90 p-4 shadow-soft">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-smoke-200">{label}</p>
                  <p className="mt-2 text-sm font-medium text-smoke-400">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {paths.map((path, index) => (
              <motion.div
                key={path.title}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.48, delay: index * 0.06, ease }}
              >
                <Card interactive className="h-full overflow-hidden border-smoke-400/10 bg-ivory-100/88 shadow-card">
                  <CardHeader className={`border-b border-smoke-400/[0.06] bg-gradient-to-br ${path.accent}`}>
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/75 text-smoke-400 ring-1 ring-smoke-400/[0.05]">
                        <Icon icon={path.icon} className="h-6 w-6" aria-hidden />
                      </span>
                      <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-smoke-200">
                        Path
                      </span>
                    </div>
                    <CardTitle className="mt-5 text-xl">{path.title}</CardTitle>
                    <p className="text-sm leading-relaxed text-smoke-200">{path.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2 text-sm text-smoke-300">
                      {path.bullets.map((bullet) => (
                        <div key={bullet} className="flex items-start gap-2">
                          <Icon icon="ph:check-circle-duotone" className="mt-0.5 h-4 w-4 shrink-0 text-smoke-400" aria-hidden />
                          <span>{bullet}</span>
                        </div>
                      ))}
                    </div>
                    <Button asChild size="lg" className="w-full shadow-soft">
                      <Link href={path.href}>{path.cta}</Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
