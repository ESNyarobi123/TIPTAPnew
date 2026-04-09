'use client';

import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ease = [0.22, 1, 0.36, 1] as const;

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.5, ease },
};

const featureCards = [
  {
    icon: 'fluent-color:apps-list-detail-32',
    title: 'Smart QR entry',
    body: 'Context loads before chat starts.',
  },
  {
    icon: 'fluent-color:chat-48',
    title: 'WhatsApp service',
    body: 'Menus, requests, tips, and payments in one channel.',
  },
  {
    icon: 'fluent-color:people-team-48',
    title: 'Role-shaped workspaces',
    body: 'Managers, staff, and admins see only what they need.',
  },
  {
    icon: 'fluent-color:coin-multiple-48',
    title: 'Separated payments',
    body: 'Each merchant keeps separate payment rails.',
  },
  {
    icon: 'fluent-color:data-trending-48',
    title: 'Operational analytics',
    body: 'Service, finance, and feedback in one view.',
  },
  {
    icon: 'fluent-color:globe-shield-48',
    title: 'Public + private match',
    body: 'Landing, QR, dashboards, and staff tools stay aligned.',
  },
];

const flowSteps = [
  {
    icon: 'fluent-color:apps-list-detail-32',
    title: 'Scan',
    body: 'Customer scans QR.',
  },
  {
    icon: 'fluent-color:chat-48',
    title: 'Chat',
    body: 'WhatsApp opens in the right context.',
  },
  {
    icon: 'fluent-color:book-database-32',
    title: 'Operate',
    body: 'Data flows back to dashboards.',
  },
];

const roleCards = [
  {
    icon: 'fluent-color:building-store-24',
    title: 'Manager / owner',
    body: 'Run QR, staff, payments, and reports.',
    href: '/get-started',
    cta: 'Manager path',
  },
  {
    icon: 'fluent-color:person-starburst-48',
    title: 'Staff / provider',
    body: 'Use a personal workspace for assignments, tips, and ratings.',
    href: '/get-started',
    cta: 'Staff path',
  },
  {
    icon: 'fluent-color:contact-card-48',
    title: 'Returning users',
    body: 'Sign in and go straight to the right workspace.',
    href: '/login',
    cta: 'Sign in',
  },
];

const navItems = [
  {
    href: '/#features',
    label: 'Features',
    icon: 'fluent-color:apps-list-detail-32',
  },
  {
    href: '/#flow',
    label: 'Flow',
    icon: 'fluent-color:chat-48',
  },
  {
    href: '/#roles',
    label: 'Roles',
    icon: 'fluent-color:people-team-48',
  },
  {
    href: '/login',
    label: 'Workspace',
    icon: 'fluent-color:building-shop-24',
  },
];

const heroStats = [
  {
    label: 'Entry',
    value: 'QR to WhatsApp',
    icon: 'fluent-color:apps-list-detail-32',
  },
  {
    label: 'Finance',
    value: 'Per-merchant rails',
    icon: 'fluent-color:coin-multiple-48',
  },
  {
    label: 'Teams',
    value: 'Role-shaped desks',
    icon: 'fluent-color:people-team-48',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f6f0e4] text-smoke-400 selection:bg-smoke-400/12">
      <header className="sticky top-0 z-30 border-b border-smoke-400/[0.07] bg-[#f8f2e8]/84 backdrop-blur-xl backdrop-saturate-150">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-smoke-400/12 to-transparent" />
        <div className="relative mx-auto flex h-[4.75rem] max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
          <Link href="/" className="group flex items-center gap-3 font-display text-lg font-semibold tracking-tight">
            <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-smoke-400 text-sm text-ivory-100 shadow-soft transition group-hover:bg-smoke-300">
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(238,235,217,0.25),transparent_60%)]" />
              <span className="relative">T</span>
            </span>
            TIPTAP
          </Link>

          <nav className="hidden items-center rounded-full border border-smoke-400/[0.08] bg-white/58 p-1.5 shadow-soft lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium text-smoke-200 transition hover:bg-smoke-400/[0.06] hover:text-smoke-400"
              >
                <Icon icon={item.icon} className="h-4.5 w-4.5 shrink-0" aria-hidden />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center rounded-full border border-smoke-400/[0.08] bg-white/60 p-1 shadow-soft max-lg:flex">
              {navItems.slice(0, 3).map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-smoke-400/[0.05]"
                  aria-label={item.label}
                >
                  <Icon icon={item.icon} className="h-5 w-5" aria-hidden />
                </Link>
              ))}
            </div>
            <Link
              href="/login"
              className="hidden rounded-full px-4 py-2 text-sm font-medium text-smoke-200 transition hover:bg-smoke-400/[0.05] hover:text-smoke-400 sm:inline-block"
            >
              Sign in
            </Link>
            <Button size="sm" className="rounded-full px-5 shadow-soft" asChild>
              <Link href="/get-started">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-smoke-400/[0.05]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(251,191,36,0.16),transparent_26%),radial-gradient(circle_at_100%_100%,rgba(59,130,246,0.08),transparent_24%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(40,36,39,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(40,36,39,0.045)_1px,transparent_1px)] [background-size:88px_88px]" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-14 md:px-6 md:pb-28 md:pt-20 lg:grid-cols-[minmax(0,1.02fr)_minmax(380px,0.98fr)]">
            <motion.div {...reveal} className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-700/12 bg-amber-50/88 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-900/70 shadow-soft">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                QR • WhatsApp • Operations
              </div>

              <h1 className="mt-6 font-display text-[2.45rem] font-semibold leading-[0.98] tracking-tight text-balance md:text-[3.7rem] lg:text-[4.15rem]">
                One clean system
                <span className="block text-amber-950/88">for service businesses.</span>
              </h1>

              <p className="mt-5 max-w-xl text-[16px] text-smoke-200 md:text-[17px]">
                Launch guests through QR, serve them in WhatsApp, and keep every team in one sharp workspace.
              </p>

              <div className="mt-10 flex flex-wrap gap-3">
                <Button size="lg" className="rounded-full px-6 shadow-card" asChild>
                  <Link href="/get-started">Start with TIPTAP</Link>
                </Button>
                <Button size="lg" variant="secondary" className="rounded-full ring-1 ring-smoke-400/12" asChild>
                  <Link href="/login">Open workspace</Link>
                </Button>
              </div>

              <div className="mt-6 flex flex-wrap gap-2.5">
                {['QR launch', 'WhatsApp desk', 'Role routing', 'Merchant payments'].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-smoke-400/[0.08] bg-white/62 px-4 py-2 text-xs font-medium text-smoke-300 shadow-soft"
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {heroStats.map((item) => (
                  <div key={item.label} className="rounded-[1.35rem] border border-smoke-400/[0.08] bg-ivory-50/88 p-4 shadow-soft">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-smoke-200">{item.label}</p>
                      <Icon icon={item.icon} className="h-6 w-6" aria-hidden />
                    </div>
                    <p className="mt-3 font-display text-base font-semibold text-smoke-400 md:text-lg">{item.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.06 }} className="relative">
              <div className="rounded-[2rem] border border-smoke-400/[0.08] bg-[linear-gradient(180deg,rgba(255,253,248,0.97),rgba(241,233,219,0.92))] p-6 shadow-[0_32px_90px_-42px_rgba(15,23,42,0.42)] md:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Control surface</p>
                    <p className="mt-2 font-display text-2xl font-semibold text-smoke-400">One product, clear lanes</p>
                  </div>
                  <Icon icon="fluent-color:apps-48" className="h-12 w-12 shrink-0" aria-hidden />
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.35rem] border border-smoke-400/[0.07] bg-ivory-100/90 p-4 shadow-soft">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 ring-1 ring-smoke-400/[0.05]">
                        <Icon icon="fluent-color:chat-48" className="h-6 w-6" aria-hidden />
                      </span>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-900">
                        Live
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-semibold text-smoke-400">Guest inbox</p>
                    <p className="mt-1 text-xs text-smoke-200">Chat and requests.</p>
                  </div>

                  <div className="rounded-[1.35rem] border border-smoke-400/[0.07] bg-ivory-100/90 p-4 shadow-soft">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 ring-1 ring-smoke-400/[0.05]">
                        <Icon icon="fluent-color:coin-multiple-48" className="h-6 w-6" aria-hidden />
                      </span>
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-900">
                        Finance
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-semibold text-smoke-400">Merchant payments</p>
                    <p className="mt-1 text-xs text-smoke-200">Separate provider credentials.</p>
                  </div>
                </div>

                <div className="mt-6 rounded-[1.5rem] bg-smoke-400 p-5 text-ivory-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ivory-200/65">Role routing</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-ivory-100/[0.08] bg-ivory-100/[0.06] px-4 py-3">
                      <p className="text-xs font-semibold text-ivory-100">Manager</p>
                      <p className="mt-1 text-[11px] text-ivory-200/80">Control room</p>
                    </div>
                    <div className="rounded-2xl border border-ivory-100/[0.08] bg-ivory-100/[0.06] px-4 py-3">
                      <p className="text-xs font-semibold text-ivory-100">Staff</p>
                      <p className="mt-1 text-[11px] text-ivory-200/80">Personal desk</p>
                    </div>
                    <div className="rounded-2xl border border-ivory-100/[0.08] bg-ivory-100/[0.06] px-4 py-3">
                      <p className="text-xs font-semibold text-ivory-100">Admin</p>
                      <p className="mt-1 text-[11px] text-ivory-200/80">Platform command</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="features" className="border-b border-smoke-400/[0.05] py-20 md:py-24">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <motion.div {...reveal} className="mx-auto max-w-2xl text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-smoke-200">Features</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-[2.7rem]">
                Everything stays connected, but never mixed up.
              </h2>
                <p className="mt-4 text-[14px] text-smoke-200 md:text-[15px]">
                  Guest flow, staff flow, and finance flow in one system.
                </p>
            </motion.div>

            <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {featureCards.map((feature, index) => (
                <motion.div key={feature.title} {...reveal} transition={{ ...reveal.transition, delay: index * 0.04 }}>
                  <div className="rounded-[1.6rem] border border-smoke-400/[0.08] bg-ivory-50/92 p-5 shadow-soft">
                    <Icon icon={feature.icon} className="h-10 w-10" aria-hidden />
                    <p className="mt-4 font-display text-xl font-semibold text-smoke-400">{feature.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-smoke-200">{feature.body}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="flow" className="border-b border-smoke-400/[0.05] py-20 md:py-24">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 md:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
            <motion.div {...reveal} className="space-y-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-smoke-200">System flow</p>
              <h2 className="font-display text-3xl font-semibold tracking-tight md:text-[2.6rem]">
                Simple outside. Structured inside.
              </h2>
              <p className="max-w-xl text-[14px] text-smoke-200 md:text-[15px]">
                Fast for customers. Clear for teams.
              </p>
            </motion.div>

            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-3">
                {flowSteps.map((step, index) => (
                  <motion.div key={step.title} {...reveal} transition={{ ...reveal.transition, delay: index * 0.05 }}>
                    <div className="rounded-[1.55rem] border border-smoke-400/[0.08] bg-ivory-50/92 p-5 shadow-soft">
                      <Icon icon={step.icon} className="h-9 w-9" aria-hidden />
                      <p className="mt-4 font-display text-lg font-semibold text-smoke-400">{step.title}</p>
                      <p className="mt-2 text-sm text-smoke-200">{step.body}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.08 }}>
                <div className="rounded-[1.8rem] border border-smoke-400/[0.08] bg-gradient-to-br from-smoke-400 to-[#2c292f] p-6 text-ivory-100 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.72)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ivory-200/60">Inside TIPTAP</p>
                      <p className="mt-2 font-display text-2xl font-semibold">Four clear lanes.</p>
                    </div>
                    <Icon icon="fluent-color:data-trending-48" className="h-12 w-12 shrink-0" aria-hidden />
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {['QR launch', 'Inbox', 'Staff', 'Payments'].map((lane) => (
                      <div key={lane} className="rounded-2xl border border-ivory-100/[0.08] bg-ivory-100/[0.06] px-4 py-3 text-sm">
                        {lane}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section id="roles" className="py-20 md:py-24">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <motion.div {...reveal} className="mx-auto max-w-2xl text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-smoke-200">Role entry</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-[2.7rem]">
                Pick the right lane.
              </h2>
            </motion.div>

            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {roleCards.map((card, index) => (
                <motion.div key={card.title} {...reveal} transition={{ ...reveal.transition, delay: index * 0.05 }}>
                  <Card interactive className="h-full overflow-hidden border-smoke-400/10 bg-ivory-100/90 shadow-card">
                    <CardHeader className="border-b border-smoke-400/[0.06] bg-[linear-gradient(180deg,rgba(255,253,248,0.9),rgba(244,239,229,0.65))]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Path</p>
                          <CardTitle className="mt-3 text-xl">{card.title}</CardTitle>
                        </div>
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/78 text-smoke-400 ring-1 ring-smoke-400/[0.05]">
                          <Icon icon={card.icon} className="h-6 w-6" aria-hidden />
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <p className="text-sm leading-relaxed text-smoke-200">{card.body}</p>
                      <Button asChild className="w-full rounded-2xl shadow-soft">
                        <Link href={card.href}>{card.cta}</Link>
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="pb-20 md:pb-24">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <motion.div
              {...reveal}
              className="overflow-hidden rounded-[2rem] border border-smoke-400/[0.08] bg-gradient-to-br from-smoke-400 to-[#2b292f] p-8 text-ivory-100 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.72)] md:p-10"
            >
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ivory-200/62">
                    Ready to begin
                  </p>
                  <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-[2.7rem]">
                    Bring your business into one cleaner operating system.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ivory-200/85 md:text-[15px]">
                    Start with the path that matches your role, then grow into QR launch, WhatsApp service, staff management, and finance control.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button size="lg" className="rounded-full bg-ivory-100 px-6 text-smoke-400 hover:bg-ivory-50" asChild>
                    <Link href="/get-started">Get started</Link>
                  </Button>
                  <Button size="lg" variant="outline" className="rounded-full border-ivory-100/18 px-6 text-ivory-100 hover:bg-ivory-100/[0.08]" asChild>
                    <Link href="/login">Sign in</Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
    </div>
  );
}
