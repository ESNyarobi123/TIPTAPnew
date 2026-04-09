import { cn } from '@/lib/cn';

export function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-nowrap items-end gap-3 overflow-x-auto overflow-y-visible rounded-2xl border border-smoke-400/10 bg-ivory-50/90 p-3 shadow-soft backdrop-blur-sm [-webkit-overflow-scrolling:touch] sm:flex-wrap sm:gap-4 sm:p-4',
        className,
      )}
    >
      {children}
    </div>
  );
}
