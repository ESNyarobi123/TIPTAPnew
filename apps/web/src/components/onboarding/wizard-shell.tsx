'use client';

import Link from 'next/link';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/cn';
import { compactText } from '@/lib/copy';

export type WizardStep = {
  key: string;
  label: string;
  href: string;
};

export function WizardShell({
  title,
  subtitle,
  steps,
  currentKey,
  children,
}: {
  title: string;
  subtitle?: string;
  steps: WizardStep[];
  currentKey: string;
  children: React.ReactNode;
}) {
  const idx = Math.max(0, steps.findIndex((s) => s.key === currentKey));
  const progress = steps.length ? Math.round(((idx + 1) / steps.length) * 100) : 0;
  const summary = subtitle ? compactText(subtitle, 96) : '';

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
          <div className="hidden items-center gap-3 md:flex">
            <div className="h-2 w-48 overflow-hidden rounded-full bg-smoke-400/[0.08]">
              <div className="h-full bg-smoke-400" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs font-semibold text-smoke-200">{progress}%</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-smoke-200">Onboarding</p>
              <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
              {summary ? <p className="max-w-xl text-[13px] text-smoke-200">{summary}</p> : null}
            </div>
            <div className="mt-8">{children}</div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[1.5rem] border border-smoke-400/10 bg-ivory-50/80 p-5 shadow-soft">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Steps</p>
              <ol className="mt-4 space-y-2">
                {steps.map((s, i) => {
                  const done = i < idx;
                  const active = s.key === currentKey;
                  return (
                    <li key={s.key}>
                      <Link
                        href={s.href}
                        className={cn(
                          'flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition',
                          active
                            ? 'border-smoke-400/18 bg-ivory-100 shadow-soft'
                            : 'border-smoke-400/[0.06] bg-transparent hover:border-smoke-400/14 hover:bg-ivory-100/40',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-xl ring-1',
                            done
                              ? 'bg-emerald-700/10 text-emerald-900 ring-emerald-800/15'
                              : active
                                ? 'bg-smoke-400/[0.06] text-smoke-400 ring-smoke-400/[0.06]'
                                : 'bg-smoke-400/[0.04] text-smoke-200 ring-smoke-400/[0.05]',
                          )}
                        >
                          <Icon
                            icon={done ? 'ph:check-duotone' : 'ph:circle-duotone'}
                            className="h-4 w-4"
                            aria-hidden
                          />
                        </span>
                        <span className={cn('min-w-0 truncate', active ? 'font-semibold text-smoke-400' : 'text-smoke-200')}>
                          {s.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="rounded-[1.5rem] border border-smoke-400/10 bg-smoke-400 p-5 text-ivory-100 shadow-card-hover">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ivory-200/85">TIPTAP principle</p>
              <p className="mt-3 font-display text-lg font-semibold leading-snug">Set up first. Enter after.</p>
              <p className="mt-2 text-[13px] text-ivory-200/95">Keeps routes and operations clean.</p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
