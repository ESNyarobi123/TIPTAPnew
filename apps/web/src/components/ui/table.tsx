import { cn } from '@/lib/cn';

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-smoke-400/[0.08] bg-ivory-50/90 shadow-[0_1px_0_rgba(40,36,39,0.04)_inset]">
      <table
        className={cn(
          'w-full min-w-[min(100%,640px)] text-left text-sm sm:min-w-[640px]',
          '[&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-smoke-400/[0.035]',
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'border-b border-smoke-400/[0.08] bg-smoke-400/[0.03] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-smoke-200',
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'border-b border-smoke-400/[0.05] px-4 py-3 text-smoke-300 transition-colors',
        className,
      )}
      {...props}
    />
  );
}
