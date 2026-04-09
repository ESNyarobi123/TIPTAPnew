'use client';

import { Icon } from '@iconify/react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { setStoredToken } from '@/lib/auth/storage';
import { useScope } from '@/providers/scope-provider';

function resolveViewerName(name?: string | null, email?: string | null) {
  const cleanName = name?.trim();
  if (cleanName) {
    return cleanName;
  }
  const emailName = email?.split('@')[0]?.trim();
  return emailName ? emailName.replace(/[._-]+/g, ' ') : 'User';
}

function resolveInitials(name?: string | null, email?: string | null) {
  const tokens = resolveViewerName(name, email)
    .split(' ')
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    return 'U';
  }
  if (tokens.length === 1) {
    return tokens[0]!.slice(0, 2).toUpperCase();
  }
  return `${tokens[0]![0] ?? ''}${tokens[1]![0] ?? ''}`.toUpperCase();
}

export type WorkspaceHeaderMode = 'business' | 'provider' | 'admin';

type Props = {
  pageTitle: string;
  mode: WorkspaceHeaderMode;
};

export function WorkspaceHeaderUserMenus({ pageTitle, mode }: Props) {
  const pathname = usePathname();
  const { me, loading, tenantId, branchId, tenants, branches, setTenantId, setBranchId } = useScope();
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const headerMenusRef = useRef<HTMLDivElement | null>(null);

  const displayName = resolveViewerName(me?.name, me?.email);
  const initials = resolveInitials(me?.name, me?.email);
  const activeTenantName = tenants.find((t) => t.id === tenantId)?.name ?? null;
  const activeBranchName = branches.find((b) => b.id === branchId)?.name ?? null;

  const workspaceSummary =
    mode === 'admin'
      ? 'Platform-wide access · Super admin'
      : activeTenantName && activeBranchName
        ? `${activeTenantName} · ${activeBranchName}`
        : activeTenantName
          ? `${activeTenantName} · All branches`
          : 'Choose the business and branch you need when available.';

  const scopeStateLabel = tenantId ? 'Scope live' : 'Needs selection';
  const showTenantBranch = mode !== 'admin';

  const avatarSubtitle =
    mode === 'admin'
      ? 'Super admin'
      : mode === 'provider'
        ? (activeBranchName ?? 'Personal workspace')
        : (activeBranchName ?? 'Workspace');

  useEffect(() => {
    setAccountOpen(false);
    setNotificationsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!accountOpen && !notificationsOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (!headerMenusRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
        setNotificationsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountOpen(false);
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [accountOpen, notificationsOpen]);

  const logout = () => {
    setStoredToken(null);
    window.location.href = '/login';
  };

  const closeMenus = () => {
    setAccountOpen(false);
    setNotificationsOpen(false);
  };

  return (
    <div className="relative flex shrink-0 items-center gap-2" ref={headerMenusRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setNotificationsOpen((open) => !open);
            setAccountOpen(false);
          }}
          className={cn(
            'inline-flex rounded-2xl border p-2.5 text-smoke-300 shadow-soft transition',
            notificationsOpen
              ? 'border-smoke-400/25 bg-[#f5f0e6] text-smoke-400'
              : 'border-smoke-400/10 bg-ivory-50/92 hover:border-smoke-400/15 hover:bg-ivory-50',
          )}
          aria-label="Notifications"
          aria-expanded={notificationsOpen}
          aria-haspopup="true"
        >
          <Icon icon="ph:bell-duotone" className="h-5 w-5" />
        </button>
        <AnimatePresence>
          {notificationsOpen ? (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-[1.25rem] border border-smoke-400/15 bg-[#fbf8f1] shadow-[0_20px_50px_-12px_rgba(15,23,42,0.35)]"
              role="dialog"
              aria-label="Notifications"
            >
              <div className="border-b border-smoke-400/12 bg-[#f5f0e6] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Alerts</p>
                <p className="mt-1 text-sm font-medium text-smoke-400">
                  {mode === 'admin' ? 'Platform signals' : mode === 'provider' ? 'Your work' : 'Workspace updates'}
                </p>
              </div>
              <div className="px-4 py-5">
                {mode === 'admin' ? (
                  <p className="text-sm leading-relaxed text-smoke-300">
                    No in-app feed yet. Use{' '}
                    <Link
                      href="/admin/approvals"
                      className="font-semibold text-smoke-400 underline-offset-2 hover:underline"
                      onClick={closeMenus}
                    >
                      Approvals
                    </Link>
                    ,{' '}
                    <Link
                      href="/admin/payments-health"
                      className="font-semibold text-smoke-400 underline-offset-2 hover:underline"
                      onClick={closeMenus}
                    >
                      Payment health
                    </Link>
                    , and{' '}
                    <Link
                      href="/admin/audit-risk"
                      className="font-semibold text-smoke-400 underline-offset-2 hover:underline"
                      onClick={closeMenus}
                    >
                      Audit &amp; risk
                    </Link>
                    .
                  </p>
                ) : mode === 'provider' ? (
                  <p className="text-sm leading-relaxed text-smoke-300">
                    No in-app notifications yet. Track{' '}
                    <Link
                      href="/provider/requests"
                      className="font-semibold text-smoke-400 underline-offset-2 hover:underline"
                      onClick={closeMenus}
                    >
                      Requests
                    </Link>
                    ,{' '}
                    <Link
                      href="/provider/earnings"
                      className="font-semibold text-smoke-400 underline-offset-2 hover:underline"
                      onClick={closeMenus}
                    >
                      Earnings
                    </Link>
                    , and{' '}
                    <Link
                      href="/provider/tips"
                      className="font-semibold text-smoke-400 underline-offset-2 hover:underline"
                      onClick={closeMenus}
                    >
                      Tips
                    </Link>
                    .
                  </p>
                ) : (
                  <p className="text-sm leading-relaxed text-smoke-300">
                    No in-app notifications yet. Check{' '}
                    <Link
                      href="/dashboard/payments"
                      className="font-semibold text-smoke-400 underline-offset-2 hover:underline"
                      onClick={closeMenus}
                    >
                      Payments
                    </Link>{' '}
                    and{' '}
                    <Link
                      href="/dashboard/conversations"
                      className="font-semibold text-smoke-400 underline-offset-2 hover:underline"
                      onClick={closeMenus}
                    >
                      WhatsApp inbox
                    </Link>{' '}
                    for live activity.
                  </p>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={() => {
          setAccountOpen((open) => !open);
          setNotificationsOpen(false);
        }}
        aria-label="Open account menu"
        aria-expanded={accountOpen}
        className={cn(
          'inline-flex items-center gap-2 rounded-[1.4rem] border px-2 py-2 shadow-soft transition',
          accountOpen
            ? 'border-smoke-400/25 bg-[#f5f0e6]'
            : 'border-smoke-400/10 bg-ivory-50/96 hover:border-smoke-400/15 hover:bg-ivory-50',
        )}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-smoke-400 to-smoke-300 font-display text-sm font-semibold text-ivory-50">
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-[140px] truncate text-sm font-semibold leading-tight text-smoke-400">{displayName}</span>
          <span className="block text-[11px] text-smoke-200">{avatarSubtitle}</span>
        </span>
        <Icon
          icon={accountOpen ? 'ph:caret-up-duotone' : 'ph:caret-down-duotone'}
          className="h-4 w-4 text-smoke-300"
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {accountOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[1.5rem] border border-smoke-400/15 bg-[#fbf8f1] shadow-[0_24px_80px_-28px_rgba(40,36,39,0.45)] ring-1 ring-black/[0.04]"
          >
            <div className="border-b border-smoke-400/12 bg-[#f5f0e6] px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-smoke-400 to-smoke-300 font-display text-base font-semibold text-ivory-50">
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-smoke-400">{displayName}</p>
                  <p className="truncate text-xs text-smoke-200">{me?.email}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-smoke-400/12 bg-[#ebe6dc] px-3 py-1.5 text-[11px] font-medium text-smoke-300">
                  <Icon icon="ph:squares-four-duotone" className="h-4 w-4 text-smoke-400" aria-hidden />
                  {pageTitle}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-smoke-400/12 bg-[#ebe6dc] px-3 py-1.5 text-[11px] font-medium text-smoke-300">
                  <Icon icon="ph:shield-check-duotone" className="h-4 w-4 text-smoke-400" aria-hidden />
                  {me?.roles?.length ? `${me.roles.length} role(s)` : 'Access active'}
                </span>
              </div>
            </div>

            <div className="space-y-4 bg-[#fbf8f1] px-4 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Active workspace</p>
                <p className="mt-1 text-sm font-medium text-smoke-300">{workspaceSummary}</p>
              </div>

              {mode === 'admin' ? (
                <div className="grid gap-2">
                  <Link
                    href="/admin/impersonation"
                    className="rounded-2xl border border-smoke-400/12 bg-[#ebe6dc] px-3 py-3 text-sm font-medium text-smoke-400 transition hover:bg-[#e5dfd4]"
                    onClick={closeMenus}
                  >
                    Impersonation &amp; support access
                  </Link>
                  <Link
                    href="/dashboard"
                    className="rounded-2xl border border-smoke-400/12 bg-[#ebe6dc] px-3 py-3 text-sm font-medium text-smoke-400 transition hover:bg-[#e5dfd4]"
                    onClick={closeMenus}
                  >
                    Open merchant (manager) view
                  </Link>
                </div>
              ) : null}

              {mode === 'provider' ? (
                <div className="grid gap-2">
                  <Link
                    href="/provider/profile"
                    className="rounded-2xl border border-smoke-400/12 bg-[#ebe6dc] px-3 py-3 text-sm font-medium text-smoke-400 transition hover:bg-[#e5dfd4]"
                    onClick={closeMenus}
                  >
                    My profile &amp; registry
                  </Link>
                  <Link
                    href="/dashboard"
                    className="rounded-2xl border border-smoke-400/12 bg-[#ebe6dc] px-3 py-3 text-sm font-medium text-smoke-400 transition hover:bg-[#e5dfd4]"
                    onClick={closeMenus}
                  >
                    Manager view
                  </Link>
                </div>
              ) : null}

              {showTenantBranch ? (
                <>
                  <label className="block">
                    <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-smoke-200">
                      Business
                    </span>
                    <Select
                      className="h-11 w-full rounded-2xl border-smoke-400/15 bg-[#f5f0e6] text-sm shadow-inner"
                      value={tenantId ?? ''}
                      onChange={(e) => setTenantId(e.target.value || null)}
                      disabled={loading || tenants.length === 0}
                    >
                      <option value="">Select business</option>
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name ?? t.id.slice(0, 8)}
                        </option>
                      ))}
                    </Select>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Branch</span>
                    <Select
                      className="h-11 w-full rounded-2xl border-smoke-400/15 bg-[#f5f0e6] text-sm shadow-inner"
                      value={branchId ?? ''}
                      onChange={(e) => setBranchId(e.target.value || null)}
                      disabled={!tenantId || branches.length === 0}
                    >
                      <option value="">All branches</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name ?? b.id.slice(0, 8)}
                        </option>
                      ))}
                    </Select>
                  </label>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-2xl border border-smoke-400/12 bg-[#ebe6dc] px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Scope</p>
                      <p className="mt-1 text-sm font-medium text-smoke-400">{scopeStateLabel}</p>
                    </div>
                    <div className="rounded-2xl border border-smoke-400/12 bg-[#ebe6dc] px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Mode</p>
                      <p className="mt-1 text-sm font-medium text-smoke-400">{pageTitle}</p>
                    </div>
                  </div>
                </>
              ) : null}

              <Button variant="outline" size="sm" type="button" onClick={logout} className="w-full border-smoke-400/18">
                Sign out
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
