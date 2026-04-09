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
    href: '/dashboard/beauty-grooming/catalog',
    title: 'Catalog',
    description: 'Services and pricing.',
    icon: 'fluent-color:gift-card-24',
    tag: 'Services',
  },
  {
    href: '/dashboard/beauty-grooming/stations',
    title: 'Stations',
    description: 'Chairs, rooms, and desks.',
    icon: 'fluent-color:building-shop-24',
    tag: 'Space',
  },
  {
    href: '/dashboard/beauty-grooming/specializations',
    title: 'Skills',
    description: 'Match staff to services.',
    icon: 'fluent-color:person-starburst-48',
    tag: 'Team',
  },
  {
    href: '/dashboard/beauty-grooming/ops',
    title: 'Live requests',
    description: 'Reception and assistance.',
    icon: 'fluent-color:people-chat-48',
    tag: 'Live',
  },
];

export default function BeautyGroomingIndexPage() {
  const { tenantId, branchId, branches, tenantCategories } = useScope();
  const branchName = branchId ? branches.find((branch) => branch.id === branchId)?.name ?? 'Selected branch' : 'All branches';
  const enabled = hasCategory(tenantCategories, 'BEAUTY_GROOMING');

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Beauty & Grooming"
        title="Studio desk"
        description="Services, stations, skills, and live help."
        tone="business"
      />

      {!tenantId ? (
        <EmptyState
          variant="premium"
          icon="fluent-color:building-shop-24"
          title="Pick a business"
          description="Choose a business to open studio tools."
        />
      ) : !enabled ? (
        <EmptyState
          variant="premium"
          icon="fluent-color:person-starburst-48"
          title="Beauty not enabled"
          description="This business is not set to Beauty & Grooming."
          action={
            <Button asChild className="rounded-full shadow-soft">
              <Link href="/dashboard/settings/categories">Open categories</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <Card className="overflow-hidden border-smoke-400/10 bg-[linear-gradient(135deg,rgba(255,253,248,0.97),rgba(233,244,239,0.9))] shadow-card">
              <CardContent className="space-y-5 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke-200">Studio control</p>
                    <h2 className="mt-2 font-display text-[1.9rem] font-semibold tracking-tight text-smoke-400">
                      Keep the service lane calm.
                    </h2>
                    <p className="mt-2 max-w-lg text-sm text-smoke-200">Organize services, stations, and staff fit without clutter.</p>
                  </div>
                  <Icon icon="fluent-color:person-feedback-48" className="h-12 w-12 shrink-0" aria-hidden />
                </div>

                <div className="flex flex-wrap gap-2">
                  {['Service cards', 'Station map', 'Team matching'].map((chip) => (
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
                    <Link href="/dashboard/beauty-grooming/ops">Open live desk</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full">
                    <Link href="/dashboard/beauty-grooming/catalog">Edit catalog</Link>
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
                    <Icon icon="fluent-color:building-people-24" className="h-10 w-10" aria-hidden />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-smoke-400/10 bg-smoke-400 text-ivory-100">
                <CardContent className="p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ivory-200/65">Quick lane</p>
                  <p className="mt-2 font-display text-xl font-semibold">Services to station to staff.</p>
                  <p className="mt-2 text-sm text-ivory-200/80">Four cards below keep the workspace tight.</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
