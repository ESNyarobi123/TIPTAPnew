'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

export type ChecklistRow = {
  key: string;
  label: string;
  hint?: string;
  href: string;
  done?: boolean;
  icon: string;
};

export function ModuleChecklist({
  title,
  subtitle,
  rows,
  accent = 'business',
}: {
  title: string;
  subtitle?: string;
  rows: ChecklistRow[];
  accent?: 'business' | 'food' | 'beauty';
}) {
  const bar =
    accent === 'food'
      ? 'from-orange-700/20'
      : accent === 'beauty'
        ? 'from-fuchsia-700/18'
        : 'from-smoke-400/15';
  return (
    <div className="relative overflow-hidden rounded-[1.25rem] border border-smoke-400/[0.08] bg-ivory-100/60 shadow-soft">
      <div className={cn('absolute left-0 top-0 h-full w-1 bg-gradient-to-b to-transparent', bar)} aria-hidden />
      <div className="p-5 pl-6">
        <h3 className="font-display text-base font-semibold text-smoke-400">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-smoke-200">{subtitle}</p> : null}
        <ul className="mt-4 space-y-2">
          {rows.map((r) => (
            <li key={r.key}>
              <Link
                href={r.href}
                className="group flex items-start gap-3 rounded-2xl border border-transparent px-2 py-2 transition hover:border-smoke-400/[0.07] hover:bg-ivory-50/80"
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-smoke-400 ring-1 ring-smoke-400/[0.08]',
                    r.done ? 'bg-emerald-600/10 text-emerald-800 ring-emerald-700/20' : 'bg-smoke-400/[0.06]',
                  )}
                  aria-hidden
                >
                  <Icon icon={r.done ? 'ph:check-bold' : r.icon} className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-smoke-400 group-hover:underline-offset-2 group-hover:underline">
                    {r.label}
                  </span>
                  {r.hint ? <span className="mt-0.5 block text-xs text-smoke-200">{r.hint}</span> : null}
                </span>
                <Icon
                  icon="ph:caret-right-duotone"
                  className="ml-auto mt-1 h-4 w-4 shrink-0 text-smoke-200 opacity-0 transition group-hover:opacity-100"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
