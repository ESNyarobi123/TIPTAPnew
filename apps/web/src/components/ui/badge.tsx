import { cn } from '@/lib/cn';

export function Badge({
  className,
  variant = 'neutral',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variant === 'neutral' && 'bg-smoke-400/8 text-smoke-300 ring-1 ring-smoke-400/12',
        variant === 'success' && 'bg-emerald-500/10 text-emerald-800 ring-1 ring-emerald-600/15',
        variant === 'warning' && 'bg-amber-500/12 text-amber-900 ring-1 ring-amber-600/20',
        variant === 'danger' && 'bg-rose-500/10 text-rose-900 ring-1 ring-rose-600/20',
        className,
      )}
      {...props}
    />
  );
}
