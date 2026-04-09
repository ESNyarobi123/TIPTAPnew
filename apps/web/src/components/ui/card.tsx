import { cn } from '@/lib/cn';

export function Card({
  className,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-smoke-400/[0.08] bg-ivory-50/90 shadow-card backdrop-blur-sm',
        interactive && 'transition-shadow duration-300 hover:border-smoke-400/12 hover:shadow-card-hover',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('border-b border-smoke-400/[0.06] px-4 py-3.5 sm:px-6 sm:py-4', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('font-display text-lg font-semibold tracking-tight text-smoke-400', className)} {...props} />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 sm:p-6', className)} {...props} />;
}
