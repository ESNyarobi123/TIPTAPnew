'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const paths = [
  {
    icon: 'fluent-color:building-store-24',
    title: 'Business / manager',
    body: 'Set up the business workspace.',
    bullets: ['Branches', 'QR and payments'],
    href: '/onboarding/business/account',
    cta: 'Start manager flow',
    accent: 'from-amber-50 via-ivory-100 to-orange-100/55',
  },
  {
    icon: 'fluent-color:person-starburst-48',
    title: 'Staff / provider',
    body: 'Create your personal workspace.',
    bullets: ['Profile', 'Tips and ratings'],
    href: '/onboarding/provider/account',
    cta: 'Start staff flow',
    accent: 'from-teal-50 via-ivory-100 to-sky-100/40',
  },
] as const;

export default function RegisterPage() {
  const router = useRouter();

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-smoke-400/[0.08] bg-ivory-50/96 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.38)] ring-1 ring-white/70 backdrop-blur-sm">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-smoke-400/[0.08] bg-ivory-100/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600/85" aria-hidden />
              Create account
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-[1.85rem] font-semibold tracking-tight text-smoke-400">Create account</h1>
                <p className="mt-2 text-[13px] text-smoke-200">Pick your entry flow.</p>
              </div>
              <span className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-ivory-100 text-smoke-400 ring-1 ring-smoke-400/[0.05] sm:flex">
                <Icon icon="fluent-color:apps-48" className="h-7 w-7" aria-hidden />
              </span>
            </div>
          </div>

          <div className="grid gap-4">
            {paths.map((path) => (
              <button
                key={path.title}
                type="button"
                onClick={() => router.push(path.href)}
                className="rounded-[1.5rem] border border-smoke-400/[0.08] bg-ivory-50/88 p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-smoke-400/12 hover:shadow-card"
              >
                <div className={`rounded-[1.25rem] bg-gradient-to-br ${path.accent} p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 text-smoke-400 ring-1 ring-smoke-400/[0.05]">
                      <Icon icon={path.icon} className="h-6 w-6" aria-hidden />
                    </span>
                    <span className="rounded-full bg-white/75 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">
                      Select
                    </span>
                  </div>
                  <h2 className="mt-4 font-display text-xl font-semibold text-smoke-400">{path.title}</h2>
                  <p className="mt-2 text-sm text-smoke-200">{path.body}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {path.bullets.map((bullet) => (
                    <span
                      key={bullet}
                      className="inline-flex items-center gap-2 rounded-full border border-smoke-400/[0.08] bg-ivory-100/85 px-3 py-1.5 text-xs font-medium text-smoke-300"
                    >
                      <Icon icon="ph:check-circle-duotone" className="h-4 w-4 text-smoke-400" aria-hidden />
                      {bullet}
                    </span>
                  ))}
                </div>

                <Button type="button" className="mt-4 h-11 w-full rounded-2xl shadow-soft">
                  {path.cta}
                </Button>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="rounded-[1.35rem] border border-smoke-400/[0.08] bg-ivory-50/78 px-5 py-4 text-sm text-smoke-300 shadow-soft">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-smoke-400 underline-offset-4 hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
