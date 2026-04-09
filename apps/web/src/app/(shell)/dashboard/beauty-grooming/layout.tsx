import { CategoryWorkspaceGuard } from '@/components/workspace/category-workspace-guard';

export default function BeautyGroomingLayout({ children }: { children: React.ReactNode }) {
  return (
    <CategoryWorkspaceGuard
      category="BEAUTY_GROOMING"
      icon="fluent-color:person-starburst-48"
      title="Beauty not enabled"
      description="Enable Beauty & Grooming for this business to open service, station, and specialist tools."
    >
      {children}
    </CategoryWorkspaceGuard>
  );
}
