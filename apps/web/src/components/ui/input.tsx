import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-11 w-full rounded-xl border border-smoke-400/15 bg-ivory-50 px-4 text-sm text-smoke-400 shadow-inner placeholder:text-smoke-200/80 transition-colors focus:border-smoke-400/35 focus:outline-none focus:ring-2 focus:ring-smoke-400/15 disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
