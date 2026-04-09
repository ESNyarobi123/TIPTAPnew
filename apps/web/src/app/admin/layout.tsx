import { AdminShell } from '@/components/admin/admin-shell';
import { ScopeProvider } from '@/providers/scope-provider';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ScopeProvider>
      <AdminShell>{children}</AdminShell>
    </ScopeProvider>
  );
}

