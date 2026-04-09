import { cn } from '@/lib/cn';
import { Card, CardContent, CardHeader, CardTitle } from './card';

export function SettingsSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        'border-smoke-400/[0.09] shadow-soft ring-1 ring-smoke-400/[0.03]',
        className,
      )}
    >
      <CardHeader className="rounded-t-[inherit] border-b border-smoke-400/[0.06] bg-gradient-to-b from-smoke-400/[0.03] to-transparent">
        <CardTitle className="font-display text-base">{title}</CardTitle>
        {description ? <p className="mt-1.5 text-sm leading-relaxed text-smoke-200">{description}</p> : null}
      </CardHeader>
      <CardContent className="pt-6">{children}</CardContent>
    </Card>
  );
}
