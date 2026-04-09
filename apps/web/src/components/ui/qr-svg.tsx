'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { renderQrSvg, type RenderQrSvgOptions } from '@/lib/qr';

export function QrSvg({
  value,
  className,
  ...options
}: {
  value: string;
  className?: string;
} & RenderQrSvgOptions) {
  const [svg, setSvg] = useState('');

  useEffect(() => {
    let cancelled = false;
    void renderQrSvg(value, options)
      .then((markup) => {
        if (!cancelled) {
          setSvg(markup);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSvg('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [options.background, options.foreground, options.margin, options.size, value]);

  return (
    <div
      className={cn(
        'rounded-[24px] border border-smoke-400/[0.06] bg-white p-4 shadow-soft [&_svg]:h-full [&_svg]:w-full',
        className,
      )}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
