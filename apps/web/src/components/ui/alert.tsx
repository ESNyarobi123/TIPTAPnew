import { Icon } from '@iconify/react';
import { cn } from '@/lib/cn';

export function Alert({
  variant = 'info',
  title,
  children,
  className,
}: {
  variant?: 'info' | 'warning';
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="note"
      className={cn(
        'flex gap-3 rounded-xl border px-4 py-3 text-sm',
        variant === 'info' && 'border-smoke-400/12 bg-smoke-400/[0.04] text-smoke-300',
        variant === 'warning' && 'border-amber-500/25 bg-amber-500/8 text-amber-950',
        className,
      )}
    >
      <Icon
        icon={variant === 'warning' ? 'ph:warning-duotone' : 'ph:info-duotone'}
        className="mt-0.5 h-5 w-5 shrink-0 opacity-80"
        aria-hidden
      />
      <div>
        {title ? <p className="font-medium text-smoke-400">{title}</p> : null}
        <div className={cn(title && 'mt-1', 'text-smoke-200')}>{children}</div>
      </div>
    </div>
  );
}
