import { CategoryWorkspaceGuard } from '@/components/workspace/category-workspace-guard';

export default function FoodDiningLayout({ children }: { children: React.ReactNode }) {
  return (
    <CategoryWorkspaceGuard
      category="FOOD_DINING"
      icon="fluent-color:building-store-24"
      title="Dining not enabled"
      description="Enable Food & Dining for this business to open menu, table, and waiter tools."
    >
      {children}
    </CategoryWorkspaceGuard>
  );
}
