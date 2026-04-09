import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'min-h-[120px] w-full resize-y rounded-xl border border-smoke-400/15 bg-ivory-50 px-4 py-3 text-sm text-smoke-400 shadow-inner placeholder:text-smoke-200/80 transition-colors focus:border-smoke-400/35 focus:outline-none focus:ring-2 focus:ring-smoke-400/15 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

