import { ProviderShell } from '@/components/provider/provider-shell';
import { ScopeProvider } from '@/providers/scope-provider';

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  return (
    <ScopeProvider>
      <ProviderShell>{children}</ProviderShell>
    </ScopeProvider>
  );
}

