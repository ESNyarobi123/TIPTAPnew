'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { compactText } from '@/lib/copy';

export type AttentionItem = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail?: string;
  href?: string;
};

const severityRing: Record<AttentionItem['severity'], string> = {
  critical: 'border-rose-300/50 bg-rose-50/90 text-rose-950',
  warning: 'border-amber-300/45 bg-amber-50/85 text-amber-950',
  info: 'border-smoke-400/12 bg-ivory-50/90 text-smoke-400',
};

const severityIcon: Record<AttentionItem['severity'], string> = {
  critical: 'ph:seal-warning-duotone',
  warning: 'ph:bell-ringing-duotone',
  info: 'ph:info-duotone',
};

export function AttentionPanel({
  title,
  subtitle,
  items,
  emptyHint,
}: {
  title: string;
  subtitle?: string;
  items: AttentionItem[];
  emptyHint?: string;
}) {
  const compactSubtitle = subtitle ? compactText(subtitle, 64) : '';
  const compactEmptyHint = emptyHint ? compactText(emptyHint, 84) : '';
  return (
    <div className="rounded-[1.25rem] border border-smoke-400/[0.08] bg-gradient-to-b from-ivory-50/80 to-ivory-100/40 p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-smoke-400">{title}</h3>
          {compactSubtitle ? <p className="mt-1 text-xs text-smoke-200">{compactSubtitle}</p> : null}
        </div>
        <span className="rounded-full border border-smoke-400/10 bg-ivory-100/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-smoke-200">
          {items.length === 0 ? 'Clear' : `${items.length} active`}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-[13px] text-smoke-200">{compactEmptyHint || 'No exceptions in view.'}</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {items.map((it) => {
            const inner = (
              <div
                className={cn(
                  'flex gap-3 rounded-2xl border p-3.5 transition hover:shadow-soft',
                  severityRing[it.severity],
                )}
              >
                <Icon
                  icon={severityIcon[it.severity]}
                  className={cn(
                    'mt-0.5 h-5 w-5 shrink-0',
                    it.severity === 'critical' ? 'text-rose-700' : '',
                    it.severity === 'warning' ? 'text-amber-800' : '',
                    it.severity === 'info' ? 'text-smoke-400' : '',
                  )}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">{it.title}</p>
                  {it.detail ? <p className="mt-1 text-xs opacity-90">{compactText(it.detail, 80)}</p> : null}
                  {it.href ? (
                    <p className="mt-2 text-xs font-semibold underline-offset-2 opacity-90 group-hover:underline">
                      Open →
                    </p>
                  ) : null}
                </div>
              </div>
            );
            return (
              <li key={it.id}>
                {it.href ? (
                  <Link href={it.href} className="group block">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
