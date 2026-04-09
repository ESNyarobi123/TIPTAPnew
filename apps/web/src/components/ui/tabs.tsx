'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

const tabSpring = { type: 'spring' as const, stiffness: 420, damping: 34 };

export function TabList({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex flex-wrap gap-1 rounded-xl border border-smoke-400/10 bg-ivory-50/80 p-1',
        className,
      )}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'relative z-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:text-sm',
            value === t.id ? 'text-ivory-100' : 'text-smoke-200 hover:bg-smoke-400/[0.06] hover:text-smoke-400',
          )}
        >
          {value === t.id ? (
            <motion.span
              layoutId="tiptap-tab-pill"
              transition={tabSpring}
              className="absolute inset-0 -z-10 rounded-lg bg-smoke-400 shadow-soft"
            />
          ) : null}
          <span className="relative z-10">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
