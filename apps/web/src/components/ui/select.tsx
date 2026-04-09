import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-11 w-full cursor-pointer appearance-none rounded-xl border border-smoke-400/15 bg-ivory-50 px-4 pr-10 text-sm text-smoke-400 shadow-inner transition-colors focus:border-smoke-400/35 focus:outline-none focus:ring-2 focus:ring-smoke-400/15 disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';
