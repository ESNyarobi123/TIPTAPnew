'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { compactText } from '@/lib/copy';

export type GuidedStep = {
  icon: string;
  text: string;
  href?: string;
  cta?: string;
};

export function ProviderGuidedSurface({
  eyebrow,
  title,
  description,
  icon,
  headline,
  body,
  steps,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
  headline: string;
  body: string;
  steps: GuidedStep[];
  children?: React.ReactNode;
}) {
  const compactBody = compactText(body, 110);
  return (
    <div className="space-y-5">
      <SectionHeader tone="personal" eyebrow={eyebrow} title={title} description={description} />
      <Card className="overflow-hidden border-teal-900/12 bg-gradient-to-br from-teal-50/45 via-ivory-100/72 to-ivory-100/95 shadow-card">
        <CardContent className="space-y-5 p-5 md:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.1rem] bg-white/75 ring-1 ring-teal-800/10">
              <Icon icon={icon} className="h-7 w-7" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-xl font-semibold text-smoke-400 md:text-2xl">{headline}</h2>
              <p className="mt-2 max-w-xl text-[13px] text-smoke-200">{compactBody}</p>
              <p className="mt-2 text-[12px] text-smoke-300">Personal view only.</p>
            </div>
          </div>

          <div className="grid gap-3">
            {steps.map((step, index) => (
              <div
                key={`${step.text}-${index}`}
                className="flex gap-3 rounded-[1.25rem] border border-smoke-400/[0.07] bg-ivory-100/85 px-4 py-4 shadow-soft"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-50 ring-1 ring-teal-900/10">
                  <Icon icon={step.icon} className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug text-smoke-400">{compactText(step.text, 72)}</p>
                  {step.href && step.cta ? (
                    <Link
                      href={step.href}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-900 underline-offset-4 hover:underline"
                    >
                      {step.cta}
                      <Icon icon="ph:arrow-right-duotone" className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {children ? <div>{children}</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}
