'use client';

import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import { restoreTokenAfterImpersonation, hasStashedToken } from '@/lib/auth/impersonation';
import { setStoredToken } from '@/lib/auth/storage';
import { useScope } from '@/providers/scope-provider';

export function ImpersonationBanner() {
  const { me } = useScope();
  const imp = me?.impersonation?.by;
  if (!imp) {
    return null;
  }

  const exit = () => {
    const restored = hasStashedToken() ? restoreTokenAfterImpersonation() : false;
    if (!restored) {
      setStoredToken(null);
    }
    window.location.href = '/admin/impersonation';
  };

  return (
    <div className="border-b border-amber-900/10 bg-amber-50/55 px-4 py-3 text-sm text-amber-950 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Icon icon="ph:mask-happy-duotone" className="mt-0.5 h-5 w-5" aria-hidden />
          <div>
            <p className="font-semibold">You are impersonating this account.</p>
            <p className="text-xs opacity-90">
              Started by <span className="font-medium">{imp.name}</span> ({imp.email}).
            </p>
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" className="border-amber-900/15" onClick={exit}>
          Exit impersonation
        </Button>
      </div>
    </div>
  );
}

