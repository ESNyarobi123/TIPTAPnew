'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { useScope } from '@/providers/scope-provider';

const settingsCards = [
  {
    href: '/dashboard/settings/profile',
    title: 'Profile',
    description: 'Your account details.',
    icon: 'fluent-color:contact-card-48',
    tag: 'Account',
  },
  {
    href: '/dashboard/settings/business',
    title: 'Business',
    description: 'Business name and contacts.',
    icon: 'fluent-color:building-store-24',
    tag: 'Tenant',
  },
  {
    href: '/dashboard/settings/branch',
    title: 'Branch',
    description: 'Location profile.',
    icon: 'fluent-color:building-shop-24',
    tag: 'Branch',
  },
  {
    href: '/dashboard/settings/categories',
    title: 'Categories',
    description: 'Active verticals.',
    icon: 'fluent-color:apps-list-detail-32',
    tag: 'Catalog',
  },
  {
    href: '/dashboard/settings/payments',
    title: 'Payments',
    description: 'Rails and provider health.',
    icon: 'fluent-color:coin-multiple-48',
    tag: 'Finance',
  },
  {
    href: '/dashboard/settings/landing',
    title: 'Landing page',
    description: 'Public page and URL.',
    icon: 'fluent-color:globe-shield-48',
    tag: 'Brand',
  },
];

const workspaceCards = [
  {
    href: '/dashboard/statements',
    title: 'Statements',
    description: 'Period totals.',
    icon: 'fluent-color:data-trending-48',
  },
  {
    href: '/dashboard/reconciliation',
    title: 'Reconciliation',
    description: 'Drift and exceptions.',
    icon: 'fluent-color:alert-24',
  },
  {
    href: '/dashboard/audit-logs',
    title: 'Audit logs',
    description: 'Scoped event stream.',
    icon: 'fluent-color:book-database-32',
  },
];

export default function SettingsIndexPage() {
  const { tenantId, branchId, tenants, branches, me } = useScope();
  const tenantName = tenantId ? tenants.find((tenant) => tenant.id === tenantId)?.name ?? 'Selected business' : null;
  const branchName = branchId ? branches.find((branch) => branch.id === branchId)?.name ?? 'Selected branch' : null;

  return (
    <div className="space-y-8">
      <SectionHeader
        tone="business"
        eyebrow="Workspace setup"
        title="Settings"
        description="Everything important in one place."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Card className="overflow-hidden border-smoke-400/10 bg-[linear-gradient(135deg,rgba(255,253,248,0.97),rgba(240,235,223,0.92))] shadow-card">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Manager hub</p>
                <h2 className="mt-2 font-display text-[1.9rem] font-semibold tracking-tight text-smoke-400">
                  Clean settings, quick moves.
                </h2>
                <p className="mt-2 max-w-lg text-sm text-smoke-200">Open profile, business, payments, categories, and public page from one screen.</p>
              </div>
              <Icon icon="fluent-color:apps-48" className="h-12 w-12 shrink-0" aria-hidden />
            </div>

            <div className="flex flex-wrap gap-2">
              {['Profile', 'Business', 'Branch', 'Payments', 'Landing'].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-smoke-400/[0.08] bg-white/68 px-3 py-1.5 text-[11px] font-medium text-smoke-300 shadow-soft"
                >
                  {chip}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <Card className="border-smoke-400/10 bg-ivory-50/92">
            <CardContent className="p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Business</p>
              <p className="mt-2 font-display text-xl font-semibold text-smoke-400">{tenantName ?? 'No business selected'}</p>
            </CardContent>
          </Card>
          <Card className="border-smoke-400/10 bg-ivory-50/92">
            <CardContent className="p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Branch</p>
              <p className="mt-2 font-display text-xl font-semibold text-smoke-400">{branchName ?? 'All branches'}</p>
              <p className="mt-1 text-sm text-smoke-200">{me?.email ?? 'Manager workspace'}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {settingsCards.map((item) => (
          <Link key={item.href} href={item.href} className="block">
            <Card interactive className="h-full border-smoke-400/10 bg-ivory-50/92">
              <CardHeader className="border-b border-smoke-400/[0.06]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">{item.tag}</p>
                    <CardTitle className="mt-3 text-xl">{item.title}</CardTitle>
                  </div>
                  <Icon icon={item.icon} className="h-10 w-10 shrink-0" aria-hidden />
                </div>
              </CardHeader>
              <CardContent className="flex items-end justify-between gap-4">
                <p className="text-sm text-smoke-200">{item.description}</p>
                <span className="text-sm font-semibold text-smoke-400">Open</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Workspace tools</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {workspaceCards.map((item) => (
            <Link key={item.href} href={item.href} className="block">
              <Card interactive className="h-full border-smoke-400/10 bg-white/72">
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div>
                    <p className="font-display text-lg font-semibold text-smoke-400">{item.title}</p>
                    <p className="mt-1 text-sm text-smoke-200">{item.description}</p>
                  </div>
                  <Icon icon={item.icon} className="h-10 w-10 shrink-0" aria-hidden />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
