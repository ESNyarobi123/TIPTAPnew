import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { ScopeProvider } from '@/providers/scope-provider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ScopeProvider>
      <DashboardShell>{children}</DashboardShell>
    </ScopeProvider>
  );
}
