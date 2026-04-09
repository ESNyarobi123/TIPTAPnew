'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { me, type MeResponse } from '@/lib/api/auth';
import { listBranchesForTenant, listTenantCategories, listTenants } from '@/lib/api/tenants-branches';
import type { TenantCategoryRow } from '@/lib/business-categories';
import { syncAuthCookie } from '@/lib/auth/cookie';
import { getStoredToken } from '@/lib/auth/storage';

type TenantRow = { id: string; name?: string; status?: string };
type BranchRow = { id: string; name?: string };

type ScopeCtx = {
  me: MeResponse | null;
  loading: boolean;
  error: string | null;
  tenantId: string | null;
  branchId: string | null;
  tenants: TenantRow[];
  branches: BranchRow[];
  tenantCategories: TenantCategoryRow[];
  setTenantId: (id: string | null) => void;
  setBranchId: (id: string | null) => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<ScopeCtx | null>(null);

const SK_T = 'tiptap_scope_tenant';
const SK_B = 'tiptap_scope_branch';

function pickDefaultTenant(profile: MeResponse, tenantRows: TenantRow[]): string | null {
  const fromRole = profile.roles.find((r) => r.tenantId)?.tenantId;
  if (fromRole && tenantRows.some((t) => t.id === fromRole)) {
    return fromRole;
  }
  return tenantRows[0]?.id ?? null;
}

function pickDefaultBranch(profile: MeResponse, branchRows: BranchRow[]): string | null {
  const fromRole = profile.roles.find((r) => r.branchId)?.branchId;
  if (fromRole && branchRows.some((b) => b.id === fromRole)) {
    return fromRole;
  }
  return branchRows[0]?.id ?? null;
}

export function ScopeProvider({ children }: { children: React.ReactNode }) {
  const [meState, setMeState] = useState<MeResponse | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [tenantCategories, setTenantCategories] = useState<TenantCategoryRow[]>([]);
  const [tenantId, setTenantIdState] = useState<string | null>(null);
  const [branchId, setBranchIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBranches = useCallback(async (token: string, tid: string) => {
    const bl = await listBranchesForTenant(token, tid);
    const barr = Array.isArray(bl) ? (bl as Record<string, unknown>[]) : [];
    return barr.map((b) => ({
      id: String(b.id),
      name: typeof b.name === 'string' ? b.name : undefined,
    }));
  }, []);

  const loadCategories = useCallback(async (token: string, tid: string) => {
    const payload = await listTenantCategories(token, tid);
    const rows = Array.isArray(payload) ? (payload as Record<string, unknown>[]) : [];
    return rows.map((row) => ({
      category: String(row.category ?? ''),
      enabled: row.enabled === true,
      settings:
        row.settings && typeof row.settings === 'object' && !Array.isArray(row.settings)
          ? (row.settings as Record<string, unknown>)
          : null,
    }));
  }, []);

  const load = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setMeState(null);
      setTenants([]);
      setBranches([]);
      setTenantCategories([]);
      setTenantIdState(null);
      setBranchIdState(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const profile = await me(token);
      setMeState(profile);
      const tList = await listTenants(token);
      const tenantRows: TenantRow[] = Array.isArray(tList)
        ? (tList as Record<string, unknown>[]).map((t) => ({
            id: String(t.id),
            name: typeof t.name === 'string' ? t.name : undefined,
            status: typeof t.status === 'string' ? t.status : undefined,
          }))
        : [];
      setTenants(tenantRows);

      let tid =
        typeof window !== 'undefined' ? window.sessionStorage.getItem(SK_T) : null;
      const defaultT = pickDefaultTenant(profile, tenantRows);
      if (!tid || !tenantRows.some((t) => t.id === tid)) {
        tid = defaultT;
      }

      setTenantIdState(tid);
      if (tid) {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(SK_T, tid);
        }
        const [branchRows, categoryRows] = await Promise.all([loadBranches(token, tid), loadCategories(token, tid)]);
        setBranches(branchRows);
        setTenantCategories(categoryRows);
        let bid =
          typeof window !== 'undefined' ? window.sessionStorage.getItem(SK_B) : null;
        const defaultB = pickDefaultBranch(profile, branchRows);
        if (!bid || !branchRows.some((b) => b.id === bid)) {
          bid = defaultB;
        }
        setBranchIdState(bid);
        if (bid && typeof window !== 'undefined') {
          window.sessionStorage.setItem(SK_B, bid);
        }
      } else {
        setBranches([]);
        setTenantCategories([]);
        setBranchIdState(null);
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(SK_B);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workspace');
    } finally {
      setLoading(false);
    }
  }, [loadBranches, loadCategories]);

  useEffect(() => {
    const t = getStoredToken();
    if (t) {
      syncAuthCookie(t);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setTenantId = useCallback(
    (id: string | null) => {
      setTenantIdState(id);
      if (typeof window !== 'undefined') {
        if (id) {
          window.sessionStorage.setItem(SK_T, id);
        } else {
          window.sessionStorage.removeItem(SK_T);
        }
        window.sessionStorage.removeItem(SK_B);
      }
      setBranchIdState(null);
      const token = getStoredToken();
      if (token && id) {
        void Promise.all([loadBranches(token, id), loadCategories(token, id)]).then(([branchRows, categoryRows]) => {
          setBranches(branchRows);
          setTenantCategories(categoryRows);
          const b0 = branchRows[0]?.id ?? null;
          setBranchIdState(b0);
          if (b0 && typeof window !== 'undefined') {
            window.sessionStorage.setItem(SK_B, b0);
          }
        });
      } else {
        setBranches([]);
        setTenantCategories([]);
      }
    },
    [loadBranches, loadCategories],
  );

  const setBranchId = useCallback((id: string | null) => {
    setBranchIdState(id);
    if (typeof window !== 'undefined') {
      if (id) {
        window.sessionStorage.setItem(SK_B, id);
      } else {
        window.sessionStorage.removeItem(SK_B);
      }
    }
  }, []);

  const value = useMemo(
    () => ({
      me: meState,
      loading,
      error,
      tenantId,
      branchId,
      tenants,
      branches,
      tenantCategories,
      setTenantId,
      setBranchId,
      refresh: load,
    }),
    [meState, loading, error, tenantId, branchId, tenants, branches, tenantCategories, setTenantId, setBranchId, load],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useScope() {
  const c = useContext(Ctx);
  if (!c) {
    throw new Error('useScope must be used within ScopeProvider');
  }
  return c;
}
