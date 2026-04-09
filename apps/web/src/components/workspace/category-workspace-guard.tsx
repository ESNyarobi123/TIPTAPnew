'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { hasCategory, type BusinessCategory } from '@/lib/business-categories';
import { useScope } from '@/providers/scope-provider';

type Props = {
  category: BusinessCategory;
  icon: string;
  title: string;
  description: string;
  children: React.ReactNode;
};

export function CategoryWorkspaceGuard({ category, icon, title, description, children }: Props) {
  const { tenantId, tenantCategories } = useScope();

  if (!tenantId) {
    return (
      <EmptyState
        variant="premium"
        icon={icon}
        title="Pick a business"
        description="Choose a business first."
      />
    );
  }

  if (!hasCategory(tenantCategories, category)) {
    return (
      <EmptyState
        variant="premium"
        icon={icon}
        title={title}
        description={description}
        action={
          <Button asChild className="rounded-full shadow-soft">
            <Link href="/dashboard/settings/categories">Open categories</Link>
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}
