import { Badge } from './badge';

const SUCCESS = new Set(['COMPLETED', 'RECORDED', 'ACTIVE', 'SUCCESS']);
const WARN = new Set(['PENDING', 'PROCESSING', 'OPEN']);
const DANGER = new Set(['FAILED', 'CANCELLED', 'REJECTED', 'REVOKED']);

export function StatusChip({ status }: { status: string }) {
  const u = status.toUpperCase();
  let variant: 'success' | 'warning' | 'danger' | 'neutral' = 'neutral';
  if (SUCCESS.has(u)) {
    variant = 'success';
  } else if (WARN.has(u)) {
    variant = 'warning';
  } else if (DANGER.has(u)) {
    variant = 'danger';
  }
  return (
    <Badge variant={variant} className="font-mono text-[10px] uppercase tracking-wide">
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}
