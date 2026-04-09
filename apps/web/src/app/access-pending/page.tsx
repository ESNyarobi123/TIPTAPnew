'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { KeyValueList } from '@/components/ui/key-value-list';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusChip } from '@/components/ui/status-chip';
import { me, type MeResponse } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { getStoredToken, setStoredToken } from '@/lib/auth/storage';
import { workspacePathFromProfile } from '@/lib/auth/workspace';
import { toast } from '@/lib/toast';

function summarizeWorkspaceEligibility(roles: MeResponse['roles']) {
  const codes = new Set(roles.map((r) => r.role));
  if (codes.has('SUPER_ADMIN')) return 'Admin access is ready.';
  if (codes.has('TENANT_OWNER') || codes.has('BRANCH_MANAGER')) return 'Business workspace is ready.';
  if (codes.has('SERVICE_STAFF') || codes.has('CASHIER') || codes.has('SUPPORT_AGENT')) return 'Personal workspace is ready.';
  return 'Access is pending.';
}

export default function AccessPendingPage() {
  const token = typeof window !== 'undefined' ? getStoredToken() : null;
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<MeResponse | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    me(token)
      .then((p) => setProfile(p))
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Could not load account'))
      .finally(() => setLoading(false));
  }, [token]);

  const roleCodes = useMemo(() => (profile?.roles ?? []).map((r) => r.role), [profile?.roles]);
  const eligibility = profile ? summarizeWorkspaceEligibility(profile.roles) : '—';

  async function refreshAccess() {
    const t = getStoredToken();
    if (!t) return;
    setLoading(true);
    try {
      const p = await me(t);
      setProfile(p);
      const dest = workspacePathFromProfile(p);
      if (dest !== '/access-pending') {
        window.location.href = dest;
      } else {
        toast.info('Access not granted yet. Please try again shortly.');
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Refresh failed');
    } finally {
      setLoading(false);
    }
  }

  const signOut = () => {
    setStoredToken(null);
    window.location.href = '/login';
  };

  if (!token) {
    return (
      <EmptyState
        variant="premium"
        icon="ph:lock-key-duotone"
        title="Sign in required"
        description="Sign in to check your access status."
        action={
          <Link href="/login" className="font-semibold text-smoke-400 underline underline-offset-4">
            Sign in
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 md:space-y-10">
      <SectionHeader
        eyebrow="Access status"
        title="Your account is ready — your workspace access is pending"
        description="You successfully created an account, but TIPTAP hasn’t been instructed which business or workspace you should operate in yet. This is normal when role assignments are handled by an administrator or by a business owner."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-smoke-400/10 bg-gradient-to-br from-ivory-50/95 via-ivory-100/70 to-ivory-200/25 shadow-card lg:col-span-2">
          <CardHeader className="border-b border-smoke-400/[0.06]">
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon icon="ph:shield-check-duotone" className="h-5 w-5 text-smoke-300" aria-hidden />
              Access pending
            </CardTitle>
            <p className="text-sm text-smoke-200">
              {loading ? 'Checking your roles…' : eligibility}
            </p>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="rounded-2xl border border-amber-900/10 bg-amber-50/30 p-4 text-sm text-amber-950">
              <div className="flex gap-3">
                <Icon icon="ph:info-duotone" className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                <p className="leading-relaxed">
                  Next step: get assigned a role like <span className="font-semibold">TENANT_OWNER</span> /{' '}
                  <span className="font-semibold">BRANCH_MANAGER</span> (business) or{' '}
                  <span className="font-semibold">SERVICE_STAFF</span> (provider). Once assigned, you’ll enter the
                  correct workspace automatically.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="lg" className="shadow-soft" disabled={loading} onClick={() => void refreshAccess()}>
                {loading ? 'Refreshing…' : 'Refresh access'}
              </Button>
              <Button type="button" variant="outline" size="lg" className="border-smoke-400/18" onClick={signOut}>
                Sign out
              </Button>
              <Button asChild type="button" variant="outline" size="lg" className="border-smoke-400/18">
                <Link href="/login">Back to sign in</Link>
              </Button>
            </div>

            <p className="text-xs text-smoke-200">
              If you believe this is a mistake, contact your administrator or TIPTAP support with your email address.
            </p>
          </CardContent>
        </Card>

        <Card className="border-smoke-400/10 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Account summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <KeyValueList
              rows={[
                { label: 'Email', value: profile?.email ?? '—' },
                { label: 'Name', value: profile?.name ?? '—' },
                { label: 'Status', value: profile?.isActive ? <StatusChip status="ACTIVE" /> : <StatusChip status="INACTIVE" /> },
                { label: 'Roles', value: roleCodes.length ? roleCodes.join(', ') : 'None assigned yet' },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

