import { cn } from '@/lib/cn';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl bg-gradient-to-r from-smoke-400/[0.06] via-smoke-400/15 to-smoke-400/[0.06] bg-[length:200%_100%] animate-shimmer',
        className,
      )}
      {...props}
    />
  );
}
