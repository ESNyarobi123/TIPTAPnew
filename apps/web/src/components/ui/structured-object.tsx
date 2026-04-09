'use client';

import { cn } from '@/lib/cn';

const MAX_DEPTH = 7;

export function StructuredObject({
  value,
  depth = 0,
  className,
}: {
  value: unknown;
  depth?: number;
  className?: string;
}) {
  if (depth > MAX_DEPTH) {
    return <span className="text-xs italic text-smoke-200">Nested data truncated</span>;
  }
  if (value === null || value === undefined) {
    return <span className="text-sm text-smoke-200">—</span>;
  }
  if (typeof value === 'boolean') {
    return <span className="text-sm font-medium text-smoke-400">{value ? 'Yes' : 'No'}</span>;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    return <span className="text-sm text-smoke-400">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-sm text-smoke-200">Empty list</span>;
    }
    return (
      <ul className={cn('space-y-2', className)}>
        {value.map((v, i) => (
          <li
            key={i}
            className="rounded-xl border border-smoke-400/[0.07] bg-ivory-100/50 px-3 py-2.5 text-sm"
          >
            <StructuredObject value={v} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return <span className="text-sm text-smoke-200">No fields</span>;
  }
  return (
    <dl className={cn('space-y-2', className)}>
      {entries.map(([k, v]) => (
        <div
          key={k}
          className={cn(
            'rounded-xl border border-smoke-400/[0.06] bg-ivory-50/80 px-3 py-2.5',
            depth > 0 && 'ml-1 border-dashed',
          )}
        >
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-smoke-200">{k}</dt>
          <dd className="mt-1.5 break-words">
            <StructuredObject value={v} depth={depth + 1} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
