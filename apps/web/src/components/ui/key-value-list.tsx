import { cn } from '@/lib/cn';

export function KeyValueList({
  rows,
  className,
}: {
  rows: { label: string; value: React.ReactNode; hint?: string }[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        'overflow-hidden rounded-2xl border border-smoke-400/[0.08] bg-ivory-50/85 shadow-soft',
        className,
      )}
    >
      {rows.map((r, i) => (
        <div
          key={`${r.label}-${i}`}
          className="flex flex-col gap-0.5 border-b border-smoke-400/[0.05] px-4 py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
        >
          <dt className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-smoke-200">
            {r.label}
          </dt>
          <dd className="min-w-0 text-right sm:max-w-[65%]">
            <div className="text-sm font-medium text-smoke-400 sm:text-right">{r.value}</div>
            {r.hint ? <p className="mt-1 text-xs text-smoke-200 sm:text-right">{r.hint}</p> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
