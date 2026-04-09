'use client';

import { Icon } from '@iconify/react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, Td, Th } from '@/components/ui/table';
import { adminImpersonate, adminListUsers } from '@/lib/api/admin';
import { ApiError } from '@/lib/api/client';
import { stashTokenBeforeImpersonation, restoreTokenAfterImpersonation, hasStashedToken } from '@/lib/auth/impersonation';
import { getStoredToken, setStoredToken } from '@/lib/auth/storage';
import { replaceToWorkspaceFromToken } from '@/lib/auth/workspace';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';

export default function AdminImpersonationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    adminListUsers(token)
      .then((u) => setRows(Array.isArray(u) ? u : []))
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load users'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => String(r.email ?? '').toLowerCase().includes(needle) || String(r.name ?? '').toLowerCase().includes(needle));
  }, [rows, q]);

  async function start(userId: string) {
    const token = getStoredToken();
    if (!token) return;
    setPending(userId);
    try {
      stashTokenBeforeImpersonation();
      const res = await adminImpersonate(token, userId);
      setStoredToken(res.accessToken);
      toast.success('Impersonation started');
      await replaceToWorkspaceFromToken(router, res.accessToken);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Impersonation failed');
    } finally {
      setPending(null);
    }
  }

  const exit = () => {
    const restored = hasStashedToken() ? restoreTokenAfterImpersonation() : false;
    if (!restored) {
      setStoredToken(null);
      window.location.href = '/login';
      return;
    }
    toast.success('Exited impersonation');
    window.location.href = '/admin/impersonation';
  };

  if (!getStoredToken()) {
    return <EmptyState variant="premium" icon="ph:lock-key-duotone" title="Sign in required" description="Sign in as Super Admin to impersonate." />;
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="platform"
        eyebrow="Operator tools"
        title="Impersonation"
        description="Login-as a user to reproduce issues, verify role provisioning, and debug onboarding. Every session should be deliberate and audited."
        action={
          <Button type="button" variant="outline" className="border-smoke-400/18" onClick={exit}>
            Exit impersonation
          </Button>
        }
      />

      <Card className="border-smoke-400/10 shadow-card">
        <CardHeader className="border-b border-smoke-400/[0.06]">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon icon="ph:mask-happy-duotone" className="h-5 w-5 text-violet-900/70" aria-hidden />
            Start session
          </CardTitle>
          <p className="text-sm text-smoke-200">Choose a user. TIPTAP will switch tokens and show a banner until you exit.</p>
        </CardHeader>
        <CardContent className="pt-6">
          <FilterBar>
            <div className="space-y-1">
              <Label htmlFor="imp-q">Search</Label>
              <Input id="imp-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="email or name" className="h-10 min-w-[14rem]" />
            </div>
          </FilterBar>

          {loading ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="mt-6 text-center text-sm text-smoke-200">No users found.</p>
          ) : (
            <div className="mt-4">
              <Table>
                <thead>
                  <tr>
                    <Th>User</Th>
                    <Th>Roles</Th>
                    <Th className="text-right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((r) => (
                    <tr key={r.id}>
                      <Td>
                        <p className="font-medium text-smoke-400">{r.name ?? r.email}</p>
                        <p className="text-xs text-smoke-200">{r.email}</p>
                      </Td>
                      <Td className="text-xs text-smoke-200">
                        {(r.roles ?? []).length ? (r.roles ?? []).map((x: any) => String(x.role)).join(', ') : '—'}
                      </Td>
                      <Td className="text-right">
                        <Button type="button" size="sm" className="shadow-soft" disabled={pending === r.id} onClick={() => void start(r.id)}>
                          {pending === r.id ? 'Starting…' : 'Impersonate'}
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

