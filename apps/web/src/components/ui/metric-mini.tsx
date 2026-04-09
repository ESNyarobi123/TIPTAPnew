import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

export function MetricMini({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: string;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -1 }}
      transition={{ type: 'spring', stiffness: 480, damping: 32 }}
      className={cn(
        'rounded-2xl border border-smoke-400/[0.08] bg-ivory-50/95 p-4 shadow-soft ring-1 ring-transparent transition-[box-shadow,border-color] duration-200 hover:border-smoke-400/12 hover:shadow-card',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-200">{label}</p>
          <p className="mt-1.5 font-display text-xl font-semibold tabular-nums tracking-tight text-smoke-400 md:text-2xl">
            {value}
          </p>
          {hint ? <p className="mt-1 text-xs text-smoke-200">{hint}</p> : null}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-smoke-400/[0.07] text-smoke-400">
          <Icon icon={icon} className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </motion.div>
  );
}
