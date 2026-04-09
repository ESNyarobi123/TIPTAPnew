import { Icon } from '@iconify/react';
import { cn } from '@/lib/cn';
import { compactText } from '@/lib/copy';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  variant = 'default',
}: {
  icon: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'premium';
}) {
  const premium = variant === 'premium';
  const summary = description ? compactText(description, premium ? 100 : 88) : '';
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center overflow-hidden text-center',
        premium
          ? 'rounded-[1.35rem] border border-smoke-400/[0.08] bg-gradient-to-b from-ivory-50/95 via-ivory-100/70 to-ivory-200/25 px-6 py-14 shadow-card sm:px-10 sm:py-20'
          : 'rounded-2xl border border-dashed border-smoke-400/20 bg-ivory-50/60 px-6 py-12 sm:px-8 sm:py-16',
        className,
      )}
    >
      {premium ? (
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(40,36,39,0.06),transparent)]"
          aria-hidden
        />
      ) : null}
      <div
        className={cn(
          'relative mb-4 flex items-center justify-center text-smoke-300',
          premium
            ? 'h-16 w-16 rounded-2xl bg-smoke-400/[0.07] text-smoke-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ring-1 ring-smoke-400/[0.06]'
            : 'h-14 w-14 rounded-2xl bg-smoke-400/[0.06]',
        )}
      >
        <Icon icon={icon} className={premium ? 'h-8 w-8' : 'h-7 w-7'} aria-hidden />
      </div>
      <h3 className={cn('relative font-display font-semibold text-smoke-400', premium ? 'text-xl' : 'text-lg')}>
        {title}
      </h3>
      {summary ? <p className="relative mt-2.5 max-w-md text-[13px] text-smoke-200">{summary}</p> : null}
      {action ? <div className="relative mt-8">{action}</div> : null}
    </div>
  );
}
