import { Icon } from '@iconify/react';
import { cn } from '@/lib/cn';
import { Card, CardContent } from './card';

export function StatCard({
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
  const usesColorIcon = icon.startsWith('fluent-color:') || icon.startsWith('logos:');
  return (
    <Card interactive className={cn('overflow-hidden hover:border-smoke-400/15', className)}>
      <CardContent className="flex gap-4 p-4 sm:p-5">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1',
            usesColorIcon
              ? 'bg-white/80 ring-smoke-400/[0.04]'
              : 'bg-smoke-400/[0.06] text-smoke-400 ring-smoke-400/[0.06]',
          )}
        >
          <Icon icon={icon} className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-smoke-200">{label}</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-smoke-400">{value}</p>
          {hint ? <p className="mt-1 text-xs text-smoke-200">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
