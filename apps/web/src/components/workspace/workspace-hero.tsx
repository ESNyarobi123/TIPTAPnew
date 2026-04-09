'use client';

import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { compactText } from '@/lib/copy';

const ease = [0.22, 1, 0.36, 1] as const;

export type WorkspaceHeroTone = 'business' | 'platform' | 'personal';

const toneStyles: Record<
  WorkspaceHeroTone,
  { wrap: string; kicker: string; accent: string; glow: string }
> = {
  business: {
    wrap: 'from-ivory-50/95 via-ivory-100/80 to-ivory-200/25 border-smoke-400/[0.09]',
    kicker: 'text-amber-900/70',
    accent: 'from-amber-700/15 to-transparent',
    glow: 'bg-amber-600/[0.07]',
  },
  platform: {
    wrap: 'from-smoke-500/[0.04] via-ivory-50/90 to-ivory-100/60 border-smoke-400/[0.1]',
    kicker: 'text-violet-900/65',
    accent: 'from-violet-700/12 to-transparent',
    glow: 'bg-violet-600/[0.06]',
  },
  personal: {
    wrap: 'from-teal-950/[0.03] via-ivory-50/92 to-ivory-100/55 border-smoke-400/[0.08]',
    kicker: 'text-teal-900/65',
    accent: 'from-teal-700/12 to-transparent',
    glow: 'bg-teal-600/[0.06]',
  },
};

export function WorkspaceHero({
  tone,
  eyebrow,
  title,
  description,
  meta,
  children,
}: {
  tone: WorkspaceHeroTone;
  eyebrow: string;
  title: string;
  description: string;
  meta?: { icon: string; label: string }[];
  children?: React.ReactNode;
}) {
  const t = toneStyles[tone];
  const summary = compactText(description, 108);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease }}
      className={cn(
        'relative overflow-hidden rounded-[1.35rem] border bg-gradient-to-br p-5 shadow-card md:p-6',
        t.wrap,
      )}
    >
      <div
        className={cn('pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full blur-3xl', t.glow)}
        aria-hidden
      />
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t to-transparent',
          t.accent,
        )}
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <p className={cn('text-[10px] font-semibold uppercase tracking-[0.22em]', t.kicker)}>{eyebrow}</p>
          <h1 className="mt-2 font-display text-[1.9rem] font-semibold tracking-tight text-smoke-400 md:text-[2.1rem]">
            {title}
          </h1>
          <p className="mt-2 max-w-xl text-[13px] text-smoke-200 md:text-sm">{summary}</p>
          {meta && meta.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2.5">
              {meta.map((m) => (
                <li
                  key={m.label}
                  className="inline-flex items-center gap-2 rounded-full border border-smoke-400/[0.08] bg-ivory-100/70 px-3 py-1.5 text-xs font-medium text-smoke-300 shadow-soft"
                >
                  <Icon icon={m.icon} className="h-4 w-4 text-smoke-400" aria-hidden />
                  {m.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {children ? <div className="relative shrink-0 lg:pt-1">{children}</div> : null}
      </div>
    </motion.div>
  );
}
