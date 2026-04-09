'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { setStoredToken, setUserPreview } from '@/lib/auth/storage';
import { replaceToWorkspaceFromToken } from '@/lib/auth/workspace';
import { toast } from '@/lib/toast';

const trustPoints = [
  { icon: 'fluent-color:building-store-24', label: 'Manager' },
  { icon: 'fluent-color:people-team-48', label: 'Staff' },
  { icon: 'fluent-color:apps-48', label: 'Admin' },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const res = await login({ email, password });
      setStoredToken(res.accessToken);
      setUserPreview({ email: res.user?.email, userId: res.user?.id });
      if (next) {
        router.replace(next);
        router.refresh();
        return;
      }
      await replaceToWorkspaceFromToken(router, res.accessToken);
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not sign in');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-smoke-400/[0.08] bg-ivory-50/96 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.38)] ring-1 ring-white/70 backdrop-blur-sm">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-smoke-400/[0.08] bg-ivory-100/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600/85" aria-hidden />
              Sign in
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-[1.85rem] font-semibold tracking-tight text-smoke-400">Sign in</h1>
                <p className="mt-2 text-[13px] text-smoke-200">Open your workspace.</p>
              </div>
              <span className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-ivory-100 text-smoke-400 ring-1 ring-smoke-400/[0.05] sm:flex">
                <Icon icon="fluent-color:contact-card-48" className="h-7 w-7" aria-hidden />
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {trustPoints.map((point) => (
                <span
                  key={point.label}
                  className="inline-flex items-center gap-2 rounded-full border border-smoke-400/[0.08] bg-ivory-100/85 px-3 py-1.5 text-xs font-medium text-smoke-300"
                >
                  <Icon icon={point.icon} className="h-4 w-4" aria-hidden />
                  {point.label}
                </span>
              ))}
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@business.com"
                className="h-12 rounded-2xl"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-xs font-semibold text-smoke-200 hover:text-smoke-400">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="h-12 rounded-2xl"
              />
            </div>
            <Button type="submit" className="h-12 w-full rounded-2xl shadow-soft" disabled={pending}>
              {pending ? 'Signing in…' : 'Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-[1.35rem] border border-smoke-400/[0.08] bg-ivory-50/78 px-5 py-4 text-sm text-smoke-300 shadow-soft">
        New here?{' '}
        <Link href="/register" className="font-semibold text-smoke-400 underline-offset-4 hover:underline">
          Create an account
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Card className="border-smoke-400/[0.08] bg-ivory-50/96 p-8 text-center text-sm text-smoke-200 shadow-soft">
          Loading…
        </Card>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
