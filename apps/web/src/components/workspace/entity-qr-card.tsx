'use client';

import Link from 'next/link';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { QrSvg } from '@/components/ui/qr-svg';
import { cn } from '@/lib/cn';

type EntityMetric = {
  label: string;
  value: string;
  hint?: string;
};

type EntityActionVariant = 'primary' | 'outline' | 'ghost' | 'secondary';

type EntityAction =
  | {
      key: string;
      label: string;
      icon: string;
      onClick: () => void;
      href?: never;
      disabled?: boolean;
      variant?: EntityActionVariant;
    }
  | {
      key: string;
      label: string;
      icon: string;
      href: string;
      onClick?: never;
      disabled?: boolean;
      variant?: EntityActionVariant;
    };

const toneStyles = {
  staff: {
    shell: 'border-teal-900/12 bg-gradient-to-br from-[#fffaf0] via-[#fffdf8] to-[#eef8f6]',
    avatar: 'bg-gradient-to-br from-teal-900 to-teal-700 text-white',
    badge: 'bg-teal-50 text-teal-900 ring-1 ring-teal-900/10',
  },
  table: {
    shell: 'border-amber-900/12 bg-gradient-to-br from-[#fffaf4] via-[#fffdf7] to-[#fff2df]',
    avatar: 'bg-gradient-to-br from-amber-700 to-orange-600 text-white',
    badge: 'bg-amber-50 text-amber-900 ring-1 ring-amber-900/10',
  },
  station: {
    shell: 'border-rose-900/12 bg-gradient-to-br from-[#fff7fa] via-[#fffdf9] to-[#ffeef3]',
    avatar: 'bg-gradient-to-br from-rose-700 to-pink-600 text-white',
    badge: 'bg-rose-50 text-rose-900 ring-1 ring-rose-900/10',
  },
} as const;

function isLinkAction(action: EntityAction): action is Extract<EntityAction, { href: string }> {
  return typeof (action as { href?: string }).href === 'string';
}

export function EntityQrCard({
  tone,
  variant = 'full',
  title,
  subtitle,
  code,
  qrLabel,
  qrValue,
  previewReady,
  previewHint,
  statusLabel,
  metrics,
  actions,
}: {
  tone: keyof typeof toneStyles;
  variant?: 'full' | 'compact';
  title: string;
  subtitle?: string | null;
  code?: string | null;
  qrLabel: string;
  qrValue?: string | null;
  previewReady: boolean;
  previewHint: string;
  statusLabel: string;
  metrics: EntityMetric[];
  actions: EntityAction[];
}) {
  const styles = toneStyles[tone];
  const initial = title.trim().charAt(0).toUpperCase() || 'T';

  if (variant === 'compact') {
    const primaryActions = actions.slice(0, 2);
    const secondaryActions = actions.slice(2);

    return (
      <Card className={cn('overflow-hidden rounded-[1.6rem] border shadow-card', styles.shell)}>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] text-lg font-semibold shadow-soft',
                styles.avatar,
              )}
            >
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-base font-semibold text-smoke-400">{title}</h3>
                  <p className="mt-1 truncate text-xs text-smoke-200">{subtitle || 'TIPTAP workspace item'}</p>
                </div>
                <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold', styles.badge)}>
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-current/70" />
                  {statusLabel}
                </span>
              </div>
              {code ? (
                <p className="mt-2 truncate font-mono text-[12px] font-semibold tracking-[0.08em] text-copper-700">
                  {code}
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-smoke-400/[0.08] bg-white/80 p-3 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-smoke-200">QR</p>
              <p className="font-mono text-xs font-semibold text-smoke-400">{qrLabel}</p>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-[104px_minmax(0,1fr)] sm:items-center">
              {previewReady && qrValue ? (
                <QrSvg value={qrValue} size={168} className="w-[104px] rounded-[1rem] border-smoke-400/[0.08] p-2.5" />
              ) : (
                <div className="flex h-[104px] w-[104px] items-center justify-center rounded-[1rem] border border-dashed border-smoke-400/15 bg-ivory-100/70 text-center text-xs text-smoke-200">
                  <Icon icon="fluent-color:qr-code-24" className="h-8 w-8" aria-hidden />
                </div>
              )}

              <div className="min-w-0 space-y-2">
                <p className="line-clamp-2 text-xs text-smoke-200">
                  {previewReady ? 'Ready to scan.' : 'Generate or refresh to preview.'}
                </p>

                <div className="grid gap-2 sm:grid-cols-2">
                  {primaryActions.map((action) =>
                    isLinkAction(action) ? (
                      <Button
                        key={action.key}
                        asChild
                        variant={action.variant ?? 'outline'}
                        className="h-9 justify-start rounded-full px-3 text-xs"
                        disabled={action.disabled}
                      >
                        <Link href={action.href}>
                          <Icon icon={action.icon} className="mr-2 h-4 w-4" aria-hidden />
                          {action.label}
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        key={action.key}
                        type="button"
                        variant={action.variant ?? 'outline'}
                        className="h-9 justify-start rounded-full px-3 text-xs"
                        disabled={action.disabled}
                        onClick={action.onClick}
                      >
                        <Icon icon={action.icon} className="mr-2 h-4 w-4" aria-hidden />
                        {action.label}
                      </Button>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-[1rem] border border-smoke-400/[0.08] bg-white/68 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-smoke-200">{metric.label}</p>
                <p className="mt-1.5 text-sm font-semibold text-smoke-400">{metric.value}</p>
                {metric.hint ? <p className="mt-1 line-clamp-1 text-[11px] text-smoke-200">{metric.hint}</p> : null}
              </div>
            ))}
          </div>

          {secondaryActions.length ? (
            <div className="grid gap-2 sm:grid-cols-3">
              {secondaryActions.map((action) =>
                isLinkAction(action) ? (
                  <Button
                    key={action.key}
                    asChild
                    variant={action.variant ?? 'ghost'}
                    className="h-9 justify-start rounded-[1rem] border border-smoke-400/[0.08] bg-white/68 px-3 text-xs"
                    disabled={action.disabled}
                  >
                    <Link href={action.href}>
                      <Icon icon={action.icon} className="mr-2 h-4 w-4" aria-hidden />
                      {action.label}
                    </Link>
                  </Button>
                ) : (
                  <Button
                    key={action.key}
                    type="button"
                    variant={action.variant ?? 'ghost'}
                    className="h-9 justify-start rounded-[1rem] border border-smoke-400/[0.08] bg-white/68 px-3 text-xs"
                    disabled={action.disabled}
                    onClick={action.onClick}
                  >
                    <Icon icon={action.icon} className="mr-2 h-4 w-4" aria-hidden />
                    {action.label}
                  </Button>
                ),
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden rounded-[1.9rem] border shadow-card', styles.shell)}>
      <CardContent className="space-y-5 p-5">
        <div className="flex items-start gap-4">
          <div className={cn('flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.25rem] text-2xl font-semibold shadow-soft', styles.avatar)}>
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-display text-xl font-semibold text-smoke-400">{title}</h3>
                <p className="mt-1 truncate text-sm text-smoke-200">{subtitle || 'TIPTAP workspace item'}</p>
              </div>
              <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', styles.badge)}>
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-current/70" />
                {statusLabel}
              </span>
            </div>
            {code ? <p className="mt-3 font-mono text-[13px] font-semibold tracking-[0.08em] text-copper-700">{code}</p> : null}
          </div>
        </div>

        <div className="rounded-[1.55rem] border border-smoke-400/[0.08] bg-white/80 p-4 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">QR card</p>
            <p className="font-mono text-sm font-semibold text-smoke-400">{qrLabel}</p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
            {previewReady && qrValue ? (
              <QrSvg value={qrValue} size={180} className="w-[140px] rounded-[1.1rem] border-smoke-400/[0.08] p-3" />
            ) : (
              <div className="flex h-[140px] w-[140px] items-center justify-center rounded-[1.1rem] border border-dashed border-smoke-400/15 bg-ivory-100/70 text-center text-sm text-smoke-200">
                <div>
                  <Icon icon="fluent-color:qr-code-24" className="mx-auto h-9 w-9" aria-hidden />
                  <p className="mt-2 px-4">{previewHint}</p>
                </div>
              </div>
            )}
            <div className="flex flex-col justify-between gap-4">
              <div className="rounded-[1.1rem] border border-smoke-400/[0.08] bg-ivory-100/75 p-4">
                <p className="text-sm font-medium text-smoke-400">{previewReady ? 'Customer launch ready' : 'Launch preview pending'}</p>
                <p className="mt-2 text-sm text-smoke-200">{previewHint}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {actions.slice(0, 2).map((action) =>
                  isLinkAction(action) ? (
                    <Button key={action.key} asChild variant={action.variant ?? 'outline'} className="justify-start rounded-full" disabled={action.disabled}>
                      <Link href={action.href}>
                        <Icon icon={action.icon} className="mr-2 h-4 w-4" aria-hidden />
                        {action.label}
                      </Link>
                    </Button>
                  ) : (
                    <Button key={action.key} type="button" variant={action.variant ?? 'outline'} className="justify-start rounded-full" disabled={action.disabled} onClick={action.onClick}>
                      <Icon icon={action.icon} className="mr-2 h-4 w-4" aria-hidden />
                      {action.label}
                    </Button>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-[1.15rem] border border-smoke-400/[0.08] bg-white/68 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">{metric.label}</p>
              <p className="mt-2 text-lg font-semibold text-smoke-400">{metric.value}</p>
              {metric.hint ? <p className="mt-1 text-xs text-smoke-200">{metric.hint}</p> : null}
            </div>
          ))}
        </div>

        {actions.length > 2 ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {actions.slice(2).map((action) =>
              isLinkAction(action) ? (
                <Button key={action.key} asChild variant={action.variant ?? 'ghost'} className="justify-start rounded-[1rem] border border-smoke-400/[0.08] bg-white/68" disabled={action.disabled}>
                  <Link href={action.href}>
                    <Icon icon={action.icon} className="mr-2 h-4 w-4" aria-hidden />
                    {action.label}
                  </Link>
                </Button>
              ) : (
                <Button key={action.key} type="button" variant={action.variant ?? 'ghost'} className="justify-start rounded-[1rem] border border-smoke-400/[0.08] bg-white/68" disabled={action.disabled} onClick={action.onClick}>
                  <Icon icon={action.icon} className="mr-2 h-4 w-4" aria-hidden />
                  {action.label}
                </Button>
              ),
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
