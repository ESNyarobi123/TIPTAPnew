'use client';

import { Icon } from '@iconify/react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { ImpersonationBanner } from '@/components/ui/impersonation-banner';
import { WorkspaceHeaderUserMenus } from '@/components/workspace/header-user-menus';
import { enabledBusinessCategories } from '@/lib/business-categories';
import { cn } from '@/lib/cn';
import { useScope } from '@/providers/scope-provider';
import { getDashboardNav, mainNav } from './nav';

function resolveViewerName(name?: string | null, email?: string | null) {
  const cleanName = name?.trim();
  if (cleanName) {
    return cleanName;
  }
  const emailName = email?.split('@')[0]?.trim();
  return emailName ? emailName.replace(/[._-]+/g, ' ') : 'Manager';
}

function resolveGreeting(name?: string | null, email?: string | null) {
  const [first] = resolveViewerName(name, email).split(' ');
  return `Welcome back, ${first || 'manager'}`;
}

function resolveDashboardPageTitle(pathname: string): string {
  const candidates: { href: string; label: string }[] = [];
  for (const n of mainNav) {
    candidates.push({ href: n.href, label: n.label });
    n.children?.forEach((c) => candidates.push(c));
  }
  const isMatch = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
  const hit = candidates.filter((c) => isMatch(c.href)).sort((a, b) => b.href.length - a.href.length)[0];
  return hit?.label ?? 'Dashboard';
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { me, tenantId, branchId, tenants, branches, tenantCategories, error } = useScope();
  const navItems = useMemo(
    () => getDashboardNav(enabledBusinessCategories(tenantCategories)),
    [tenantCategories],
  );
  const activeTenant = useMemo(() => tenants.find((item) => item.id === tenantId) ?? null, [tenantId, tenants]);
  const activeTenantName = activeTenant?.name ?? null;
  const activeTenantStatus = activeTenant?.status?.toUpperCase() ?? '';
  const activeBranchName = useMemo(
    () => branches.find((item) => item.id === branchId)?.name ?? null,
    [branchId, branches],
  );
  const greeting = useMemo(() => resolveGreeting(me?.name, me?.email), [me?.email, me?.name]);
  const workspaceSummary = useMemo(() => {
    if (activeTenantName && activeBranchName) {
      return `${activeTenantName} · ${activeBranchName}`;
    }
    if (activeTenantName) {
      return `${activeTenantName} · All branches`;
    }
    return 'Choose the business and branch you want to control.';
  }, [activeBranchName, activeTenantName]);
  const scopeStateLabel = tenantId ? 'Scope live' : 'Needs selection';

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => !c);
  }, []);

  const pageTitle = useMemo(() => {
    const candidates: { href: string; label: string }[] = [];
    for (const n of navItems) {
      candidates.push({ href: n.href, label: n.label });
      n.children?.forEach((c) => candidates.push(c));
    }
    const isMatch = (href: string) =>
      pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
    const hit = candidates.filter((c) => isMatch(c.href)).sort((a, b) => b.href.length - a.href.length)[0];
    return hit?.label ?? resolveDashboardPageTitle(pathname);
  }, [navItems, pathname]);

  return (
    <div className="flex min-h-screen bg-[radial-gradient(ellipse_at_50%_0%,rgba(238,235,217,0.65),rgba(238,235,217,0.35)_45%,transparent_70%)]">
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
        animate={{ width: collapsed ? 92 : 296 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-ivory-200/20 bg-smoke-400 text-ivory-100 shadow-[4px_0_32px_-12px_rgba(40,36,39,0.35)] lg:static lg:z-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex h-[4.25rem] items-center gap-3 border-b border-ivory-100/[0.09] px-4">
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center gap-3 font-display text-[15px] font-semibold tracking-tight"
          >
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-ivory-100/22 via-ivory-100/10 to-ivory-100/6 text-base text-ivory-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-ivory-100/18">
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(238,235,217,0.2),transparent_55%)]" />
              <span className="relative">T</span>
            </span>
            {!collapsed ? (
              <span className="min-w-0 truncate">
                <span className="block leading-tight">TIPTAP</span>
                <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-ivory-200/55">
                  Business
                </span>
              </span>
            ) : null}
          </Link>
        </div>
        {!collapsed ? (
          <div className="border-b border-ivory-100/[0.08] px-3.5 py-3">
            <div className="rounded-[1.25rem] border border-ivory-100/[0.1] bg-ivory-100/[0.06] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-ivory-100/[0.1] text-ivory-50">
                  <Icon icon="ph:buildings-duotone" className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ivory-200/52">
                    Manager scope
                  </p>
                  <p className="truncate text-sm font-semibold text-ivory-50">
                    {activeTenantName ?? 'Choose tenant'}
                  </p>
                  {activeTenantStatus === 'TRIAL' ? (
                    <span className="mt-1 inline-flex w-fit rounded-full border border-amber-400/35 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
                      Pending verification
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-ivory-200/78">
                <div className="rounded-xl border border-ivory-100/[0.08] bg-black/10 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ivory-200/45">Branch</p>
                  <p className="mt-1 truncate text-sm text-ivory-50">{activeBranchName ?? 'All branches'}</p>
                </div>
                <div className="rounded-xl border border-ivory-100/[0.08] bg-black/10 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ivory-200/45">Workspace</p>
                  <p className="mt-1 truncate text-sm text-ivory-50">{me?.name ?? 'Signed-in manager'}</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-2.5 py-3">
          {navItems.map((item, idx) => {
            const showSection = !collapsed && (idx === 0 || navItems[idx - 1]!.section !== item.section);
            const active =
              pathname === item.href ||
              (item.href !== '/dashboard' &&
                (item.href.startsWith('/dashboard/settings')
                  ? pathname.startsWith('/dashboard/settings')
                  : pathname.startsWith(item.href)));
            return (
              <div key={item.href} className="relative">
                {showSection ? (
                  <p className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-ivory-200/45 first:pt-0">
                    {item.section}
                  </p>
                ) : null}
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                    className={cn(
                    'group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] font-medium tracking-tight transition-all duration-200',
                    active
                      ? 'bg-ivory-100 text-smoke-400 shadow-[0_4px_24px_-10px_rgba(40,36,39,0.28)] ring-1 ring-ivory-100/45 before:absolute before:left-1.5 before:top-1/2 before:h-7 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-smoke-400/25'
                      : 'text-ivory-200/90 hover:bg-ivory-100/[0.08] hover:text-ivory-50',
                    collapsed && 'justify-center px-2 before:hidden',
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon
                    icon={item.icon}
                    className={cn(
                      'h-[1.35rem] w-[1.35rem] shrink-0 transition-transform duration-200 group-hover:scale-105',
                      active ? 'text-smoke-400' : 'text-ivory-200/85',
                    )}
                    aria-hidden
                  />
                  {!collapsed ? <span>{item.label}</span> : null}
                </Link>
                {!collapsed && item.children && active ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="ml-3 mt-1 space-y-0.5 border-l border-ivory-100/12 pl-3"
                  >
                    {item.children.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        className={cn(
                          'block rounded-lg py-1.5 pl-1 text-[12px] transition-colors',
                          pathname === c.href
                            ? 'font-semibold text-ivory-50'
                            : 'text-ivory-200/75 hover:text-ivory-50',
                        )}
                      >
                        {c.label}
                      </Link>
                    ))}
                  </motion.div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-ivory-100/[0.09] p-2.5">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              'flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-[12px] font-medium text-ivory-200/85 transition hover:bg-ivory-100/[0.07] hover:text-ivory-50',
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
        </div>
      </motion.aside>

      <div className="flex min-w-0 flex-1 flex-col lg:min-h-screen">
        <header className="sticky top-0 z-30 border-b border-smoke-400/[0.07] bg-ivory-100/82 backdrop-blur-xl backdrop-saturate-150">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-smoke-400/12 to-transparent" />
          <div className="relative px-4 py-3 md:px-8 md:py-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  className="rounded-2xl border border-smoke-400/10 bg-ivory-50/92 p-2.5 text-smoke-300 shadow-soft transition hover:border-smoke-400/15 hover:bg-ivory-50 lg:hidden"
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
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-amber-700/12 bg-amber-50/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-900/70">
                      <span className="h-2 w-2 rounded-full bg-amber-600/70" aria-hidden />
                      {greeting}
                    </span>
                    <span className="hidden items-center gap-2 rounded-full border border-smoke-400/[0.08] bg-ivory-50/82 px-2.5 py-1 text-[10px] font-medium text-smoke-300 sm:inline-flex">
                      <Icon icon="ph:radar-duotone" className="h-3.5 w-3.5 text-smoke-400" aria-hidden />
                      {scopeStateLabel}
                    </span>
                  </div>
                  <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 className="truncate font-display text-[1.15rem] font-semibold tracking-tight text-smoke-400 md:text-[1.25rem]">
                      {pageTitle}
                    </h2>
                    <span className="truncate text-sm text-smoke-200">{workspaceSummary}</span>
                  </div>
                </div>
              </div>

              <WorkspaceHeaderUserMenus pageTitle={pageTitle} mode="business" />
            </div>
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

        {tenantId && activeTenantStatus === 'TRIAL' ? (
          <div
            role="status"
            className="border-b border-amber-300/35 bg-gradient-to-r from-amber-50 via-ivory-50 to-amber-50/80 px-4 py-3.5 md:px-8"
          >
            <div className="mx-auto flex max-w-7xl flex-wrap items-start gap-3 md:items-center md:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-200/50 text-amber-950">
                  <Icon icon="ph:hourglass-high-duotone" className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-950">Account pending verification</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-amber-950/85">
                    <span className="font-medium">{activeTenantName ?? 'This business'}</span> is in trial until a platform
                    administrator activates it. You can keep setting up; some limits may apply until activation.
                  </p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center rounded-full border border-amber-800/15 bg-amber-100/80 px-3 py-1.5 text-xs font-semibold text-amber-950">
                Status: TRIAL
              </span>
            </div>
          </div>
        ) : null}

        {tenantId && activeTenantStatus === 'SUSPENDED' ? (
          <div
            role="alert"
            className="border-b border-rose-300/40 bg-gradient-to-r from-rose-50 to-ivory-50 px-4 py-3.5 md:px-8"
          >
            <div className="mx-auto flex max-w-7xl flex-wrap items-start gap-3 md:items-center md:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-rose-200/55 text-rose-950">
                  <Icon icon="ph:prohibit-duotone" className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-rose-950">Business suspended</p>
                  <p className="mt-0.5 text-sm text-rose-950/90">
                    This workspace is suspended. Contact platform support or your administrator.
                  </p>
                </div>
              </div>
              <span className="inline-flex shrink-0 rounded-full border border-rose-800/20 bg-rose-100/90 px-3 py-1.5 text-xs font-semibold text-rose-950">
                SUSPENDED
              </span>
            </div>
          </div>
        ) : null}

        <main className="flex-1 px-4 py-7 md:px-8 md:py-10">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
