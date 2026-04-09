'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';

export type ActivityRailItem = {
  id: string;
  title: string;
  detail?: string;
  href?: string;
  icon: string;
};

export function ActivityRail({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: ActivityRailItem[];
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-smoke-400/[0.08] bg-gradient-to-b from-ivory-100/75 to-ivory-50/50 p-5 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-smoke-400">{title}</h3>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-smoke-200">Live</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-5 text-sm text-smoke-200">{emptyLabel ?? 'Signals will appear as guests interact.'}</p>
      ) : (
        <ul className="mt-4 max-h-[280px] space-y-1 overflow-y-auto pr-1">
          {items.map((it) => {
            const row = (
              <div className="flex gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-ivory-100/80">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-smoke-400/[0.06] text-smoke-400">
                  <Icon icon={it.icon} className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-smoke-400">{it.title}</p>
                  {it.detail ? <p className="text-xs text-smoke-200">{it.detail}</p> : null}
                </div>
              </div>
            );
            return (
              <li key={it.id}>
                {it.href ? (
                  <Link href={it.href} className="block">
                    {row}
                  </Link>
                ) : (
                  row
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
