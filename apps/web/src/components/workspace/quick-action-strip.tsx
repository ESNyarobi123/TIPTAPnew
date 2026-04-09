'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { compactText } from '@/lib/copy';

export type QuickAction = {
  href: string;
  label: string;
  icon: string;
  hint?: string;
};

export function QuickActionStrip({
  actions,
  title = 'Quick actions',
  className,
  accent,
}: {
  actions: QuickAction[];
  title?: string;
  className?: string;
  accent?: 'default' | 'platform' | 'personal';
}) {
  const accentCls =
    accent === 'platform'
      ? 'border-violet-200/40 bg-violet-50/35'
      : accent === 'personal'
        ? 'border-teal-200/35 bg-teal-50/30'
        : 'border-smoke-400/[0.07] bg-ivory-50/50';
  return (
    <div className={cn('rounded-[1.25rem] border p-4 shadow-soft', accentCls, className)}>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-smoke-200">{title}</h3>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {actions.map((a, i) => {
          const usesColorIcon = a.icon.startsWith('fluent-color:') || a.icon.startsWith('logos:');
          return (
            <motion.div
              key={a.href}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                href={a.href}
                className="group flex items-center gap-3 rounded-2xl border border-smoke-400/[0.06] bg-ivory-100/80 px-3.5 py-3 transition hover:border-smoke-400/15 hover:shadow-card"
              >
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 transition',
                    usesColorIcon
                      ? 'bg-white/80 ring-smoke-400/[0.04]'
                      : 'bg-smoke-400/[0.06] text-smoke-400 ring-smoke-400/[0.06] group-hover:bg-smoke-400/[0.09]',
                  )}
                >
                  <Icon icon={a.icon} className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight text-smoke-400">{a.label}</span>
                  {a.hint ? <span className="mt-0.5 block text-[11px] text-smoke-200">{compactText(a.hint, 26)}</span> : null}
                </span>
                <Icon
                  icon="ph:arrow-right-duotone"
                  className="ml-auto h-5 w-5 shrink-0 text-smoke-200 transition group-hover:translate-x-0.5 group-hover:text-smoke-400"
                  aria-hidden
                />
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
