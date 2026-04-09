'use client';

import { Icon } from '@iconify/react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ImpersonationBanner } from '@/components/ui/impersonation-banner';
import { WorkspaceHeaderUserMenus } from '@/components/workspace/header-user-menus';
import { cn } from '@/lib/cn';
import { setStoredToken } from '@/lib/auth/storage';
import { useScope } from '@/providers/scope-provider';
import { providerNav } from './provider-nav';

export function ProviderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { me, error } = useScope();

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => !current);
  }, []);

  const pageTitle = useMemo(() => {
    const hit = providerNav
      .filter((item) => pathname === item.href || (item.href !== '/provider' && pathname.startsWith(`${item.href}/`)))
      .sort((a, b) => b.href.length - a.href.length)[0];
    return hit?.label ?? 'Provider';
  }, [pathname]);

  const roleCount = me?.roles?.length ?? 0;

  const logout = () => {
    setStoredToken(null);
    window.location.href = '/login';
  };

  return (
    <div className="flex min-h-screen bg-[radial-gradient(ellipse_at_50%_0%,rgba(202,244,235,0.34),rgba(245,239,227,0.55)_42%,transparent_72%)]">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-smoke-500/45 backdrop-blur-[3px] lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 92 : 292 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-teal-950/12 bg-[linear-gradient(180deg,#1f2c2a_0%,#232b2b_50%,#1d2222_100%)] text-ivory-100 shadow-[6px_0_40px_-16px_rgba(24,40,38,0.55)] lg:static lg:z-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex h-[4.25rem] items-center gap-3 border-b border-ivory-100/[0.08] px-4">
          <Link
            href="/provider"
            className="flex min-w-0 items-center gap-3 font-display text-[15px] font-semibold tracking-tight"
          >
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-teal-300/28 via-ivory-100/12 to-transparent text-sm font-semibold text-ivory-50 ring-1 ring-teal-200/25">
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(153,246,228,0.28),transparent_58%)]" />
              <span className="relative">P</span>
            </span>
            {!collapsed ? (
              <span className="min-w-0 truncate">
                <span className="block leading-tight">TIPTAP</span>
                <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-teal-200/55">
                  My work
                </span>
              </span>
            ) : null}
          </Link>
        </div>

        {!collapsed ? (
          <div className="border-b border-ivory-100/[0.08] px-3.5 py-3">
            <div className="rounded-[1.25rem] border border-ivory-100/[0.1] bg-ivory-100/[0.06] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-ivory-100/[0.1]">
                  <Icon icon="fluent-color:contact-card-48" className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ivory-200/52">Personal workspace</p>
                  <p className="truncate text-sm font-semibold text-ivory-50">{me?.name ?? 'Signed-in staff'}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                <div className="rounded-xl border border-ivory-100/[0.08] bg-black/10 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ivory-200/45">Email</p>
                  <p className="mt-1 truncate text-sm text-ivory-50">{me?.email ?? 'No email in preview'}</p>
                </div>
                <div className="rounded-xl border border-ivory-100/[0.08] bg-black/10 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ivory-200/45">Roles</p>
                  <p className="mt-1 text-sm text-ivory-50">{roleCount} active assignment{roleCount === 1 ? '' : 's'}</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-2.5 py-3">
          {providerNav.map((item, idx) => {
            const showSection = !collapsed && (idx === 0 || providerNav[idx - 1]!.section !== item.section);
            const active = pathname === item.href || (item.href !== '/provider' && pathname.startsWith(item.href));
            const usesColorIcon = item.icon.startsWith('fluent-color:') || item.icon.startsWith('logos:');
            return (
              <div key={item.href}>
                {showSection ? (
                  <p className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-ivory-200/40 first:pt-0">
                    {item.section}
                  </p>
                ) : null}
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] font-medium tracking-tight transition-all duration-200',
                    active
                      ? 'bg-ivory-100 text-smoke-400 shadow-[0_4px_24px_-10px_rgba(40,36,39,0.28)] ring-1 ring-teal-200/30 before:absolute before:left-1.5 before:top-1/2 before:h-7 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-teal-400/55'
                      : 'text-ivory-200/88 hover:bg-ivory-100/[0.07] hover:text-ivory-50',
                    collapsed && 'justify-center px-2 before:hidden',
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon
                    icon={item.icon}
                    className={cn(
                      'h-[1.35rem] w-[1.35rem] shrink-0 transition-transform duration-200 group-hover:scale-105',
                      !usesColorIcon && (active ? 'text-smoke-400' : 'text-teal-200/72'),
                    )}
                    aria-hidden
                  />
                  {!collapsed ? <span>{item.label}</span> : null}
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-ivory-100/[0.08] p-2.5">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              'flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-[12px] font-medium text-ivory-200/80 transition hover:bg-ivory-100/[0.06] hover:text-ivory-50',
              collapsed && 'justify-center',
            )}
          >
            <Icon
              icon={collapsed ? 'ph:caret-right-duotone' : 'ph:caret-left-duotone'}
              className="h-4 w-4"
              aria-hidden
            />
            {!collapsed ? <span>Compact sidebar</span> : null}
          </button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={logout}
            className={cn(
              'w-full border-ivory-100/18 text-ivory-100 hover:bg-ivory-100/[0.07]',
              collapsed && 'px-2',
            )}
          >
            {!collapsed ? 'Sign out' : <Icon icon="ph:sign-out-duotone" className="h-5 w-5" aria-hidden />}
          </Button>
        </div>
      </motion.aside>

      <div className="flex min-w-0 flex-1 flex-col lg:min-h-screen">
        <header className="sticky top-0 z-30 border-b border-smoke-400/[0.07] bg-ivory-100/82 backdrop-blur-xl backdrop-saturate-150">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-700/18 to-transparent" />
          <div className="relative flex min-h-[4.25rem] items-center justify-between gap-4 px-4 md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="rounded-xl p-2.5 text-smoke-300 transition hover:bg-smoke-400/[0.07] lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Icon icon="ph:list-duotone" className="h-6 w-6" />
              </button>
              <button
                type="button"
                className="hidden rounded-2xl border border-smoke-400/10 bg-ivory-50/92 p-2.5 text-smoke-300 shadow-soft transition hover:border-smoke-400/15 hover:bg-ivory-50 lg:inline-flex"
                onClick={toggleCollapsed}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <Icon
                  icon={collapsed ? 'ph:sidebar-simple-duotone' : 'ph:sidebar-simple-fill'}
                  className="h-5 w-5"
                />
              </button>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-900/55">Personal workspace</p>
                <h2 className="truncate font-display text-[1.2rem] font-semibold leading-tight tracking-tight text-smoke-400">
                  {pageTitle}
                </h2>
              </div>
            </div>
            <WorkspaceHeaderUserMenus pageTitle={pageTitle} mode="provider" />
          </div>
          <AnimatePresence>
            {error ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-rose-200/30 bg-rose-50/95 px-4 py-3 text-sm text-rose-900 md:px-8"
              >
                {error}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </header>
        <ImpersonationBanner />

        <main className="flex-1 px-4 py-7 md:px-8 md:py-10">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
