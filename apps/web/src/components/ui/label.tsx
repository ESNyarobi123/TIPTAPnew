import { cn } from '@/lib/cn';

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('text-xs font-medium uppercase tracking-wide text-smoke-200', className)}
      {...props}
    />
  );
}
