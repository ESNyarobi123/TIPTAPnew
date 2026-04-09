import { cn } from '@/lib/cn';
import { compactText } from '@/lib/copy';

const toneEyebrow: Record<'default' | 'business' | 'platform' | 'personal', string> = {
  default: 'text-smoke-200',
  business: 'text-amber-900/70',
  platform: 'text-violet-900/65',
  personal: 'text-teal-900/65',
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
  tone = 'default',
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  tone?: 'default' | 'business' | 'platform' | 'personal';
}) {
  const summary = description ? compactText(description, 96) : '';
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? (
          <p
            className={cn(
              'text-[11px] font-semibold uppercase tracking-[0.18em]',
              toneEyebrow[tone] ?? toneEyebrow.default,
            )}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-[1.8rem] font-semibold tracking-tight text-smoke-400 md:text-[2rem]">{title}</h1>
        {summary ? <p className="max-w-xl text-[13px] text-smoke-200">{summary}</p> : null}
      </div>
      {action ? <div className="w-full shrink-0 sm:w-auto">{action}</div> : null}
    </div>
  );
}
