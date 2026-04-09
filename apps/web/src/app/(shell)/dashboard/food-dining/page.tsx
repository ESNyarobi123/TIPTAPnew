'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { hasCategory } from '@/lib/business-categories';
import { useScope } from '@/providers/scope-provider';

const modules = [
  {
    href: '/dashboard/food-dining/menu',
    title: 'Menu',
    description: 'Items and categories.',
    icon: 'fluent-color:gift-card-24',
    tag: 'Catalog',
  },
  {
    href: '/dashboard/food-dining/tables',
    title: 'Tables',
    description: 'Seats and floor spots.',
    icon: 'fluent-color:building-store-24',
    tag: 'Floor',
  },
  {
    href: '/dashboard/food-dining/ops',
    title: 'Live requests',
    description: 'Waiter and bill calls.',
    icon: 'fluent-color:people-chat-48',
    tag: 'Live',
  },
];

export default function FoodDiningIndexPage() {
  const { tenantId, branchId, branches, tenantCategories } = useScope();
  const branchName = branchId ? branches.find((branch) => branch.id === branchId)?.name ?? 'Selected branch' : 'All branches';
  const enabled = hasCategory(tenantCategories, 'FOOD_DINING');

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Food & Dining"
        title="Dining desk"
        description="Menu, tables, and live requests."
        tone="business"
      />

      {!tenantId ? (
        <EmptyState
          variant="premium"
          icon="fluent-color:building-store-24"
          title="Pick a business"
          description="Choose a business to open dining tools."
        />
      ) : !enabled ? (
        <EmptyState
          variant="premium"
          icon="fluent-color:building-store-24"
          title="Dining not enabled"
          description="This business is not set to Food & Dining."
          action={
            <Button asChild className="rounded-full shadow-soft">
              <Link href="/dashboard/settings/categories">Open categories</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <Card className="overflow-hidden border-smoke-400/10 bg-[linear-gradient(135deg,rgba(255,253,248,0.97),rgba(243,234,217,0.92))] shadow-card">
              <CardContent className="space-y-5 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Floor control</p>
                    <h2 className="mt-2 font-display text-[1.9rem] font-semibold tracking-tight text-smoke-400">
                      Dining flow stays sharp.
                    </h2>
                    <p className="mt-2 max-w-lg text-sm text-smoke-200">Keep service, tables, and menu changes in one place.</p>
                  </div>
                  <Icon icon="fluent-color:book-database-32" className="h-12 w-12 shrink-0" aria-hidden />
                </div>

                <div className="flex flex-wrap gap-2">
                  {['Menu sync', 'QR seating', 'Bill calls'].map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-smoke-400/[0.08] bg-white/72 px-3 py-1.5 text-[11px] font-medium text-smoke-300 shadow-soft"
                    >
                      {chip}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button asChild className="rounded-full shadow-soft">
                    <Link href="/dashboard/food-dining/ops">Open live desk</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full">
                    <Link href="/dashboard/food-dining/menu">Edit menu</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <Card className="border-smoke-400/10 bg-ivory-50/92">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Scope</p>
                      <p className="mt-2 font-display text-xl font-semibold text-smoke-400">{branchName}</p>
                    </div>
                    <Icon icon="fluent-color:building-shop-24" className="h-10 w-10" aria-hidden />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-smoke-400/10 bg-smoke-400 text-ivory-100">
                <CardContent className="p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ivory-200/65">Quick lane</p>
                  <p className="mt-2 font-display text-xl font-semibold">Menu to table to bill.</p>
                  <p className="mt-2 text-sm text-ivory-200/80">Use the three cards below to move faster.</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {modules.map((module) => (
              <Link key={module.href} href={module.href} className="block">
                <Card interactive className="h-full border-smoke-400/10 bg-ivory-50/92">
                  <CardHeader className="border-b border-smoke-400/[0.06]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-200">{module.tag}</p>
                        <CardTitle className="mt-3 text-xl">{module.title}</CardTitle>
                      </div>
                      <Icon icon={module.icon} className="h-10 w-10 shrink-0" aria-hidden />
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-end justify-between gap-4">
                    <p className="text-sm text-smoke-200">{module.description}</p>
                    <span className="text-sm font-semibold text-smoke-400">Open</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
