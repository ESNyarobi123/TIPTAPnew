import { cn } from '@/lib/cn';
import { Card, CardContent, CardHeader, CardTitle } from './card';

export function ChartCard({
  title,
  description,
  children,
  className,
  contentClassName,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <p className="mt-1 text-xs text-smoke-200">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent className={cn('pt-0', contentClassName)}>
        <div className="min-w-0 w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">{children}</div>
      </CardContent>
    </Card>
  );
}
