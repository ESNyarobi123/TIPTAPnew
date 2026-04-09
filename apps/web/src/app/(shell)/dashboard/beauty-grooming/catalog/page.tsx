'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { Select } from '@/components/ui/select';
import { Table, Td, Th } from '@/components/ui/table';
import { ApiError } from '@/lib/api/client';
import { apiMediaUrl } from '@/lib/api/media-url';
import {
  createService,
  createServiceCategory,
  listServiceCategories,
  listServices,
  patchService,
  patchServiceCategory,
  uploadBeautyServiceImage,
} from '@/lib/api/beauty-grooming';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

type CatRow = { id: string; name?: string; isActive?: boolean; branchId?: string | null };
type ServiceRow = {
  id: string;
  name?: string;
  categoryId?: string;
  durationMin?: number | null;
  priceCents?: number | null;
  currency?: string | null;
  isActive?: boolean;
  branchId?: string | null;
  imageUrl?: string | null;
};

function asCat(x: unknown): CatRow {
  const o = (x ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    name: typeof o.name === 'string' ? o.name : undefined,
    isActive: typeof o.isActive === 'boolean' ? o.isActive : undefined,
    branchId: typeof o.branchId === 'string' ? o.branchId : (o.branchId === null ? null : undefined),
  };
}

function asService(x: unknown): ServiceRow {
  const o = (x ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    name: typeof o.name === 'string' ? o.name : undefined,
    categoryId: typeof o.categoryId === 'string' ? o.categoryId : undefined,
    durationMin: typeof o.durationMin === 'number' ? o.durationMin : (o.durationMin === null ? null : undefined),
    priceCents: typeof o.priceCents === 'number' ? o.priceCents : (o.priceCents === null ? null : undefined),
    currency: typeof o.currency === 'string' ? o.currency : (o.currency === null ? null : undefined),
    isActive: typeof o.isActive === 'boolean' ? o.isActive : undefined,
    branchId: typeof o.branchId === 'string' ? o.branchId : (o.branchId === null ? null : undefined),
    imageUrl: typeof o.imageUrl === 'string' ? o.imageUrl : (o.imageUrl === null ? null : undefined),
  };
}

export default function BeautyCatalogPage() {
  const { tenantId, branchId } = useScope();
  const [cats, setCats] = useState<CatRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [scope, setScope] = useState<'tenant' | 'branch'>('branch');

  const effectiveBranchId = useMemo(() => (scope === 'branch' ? branchId : null), [scope, branchId]);

  const [catName, setCatName] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [serviceCategoryId, setServiceCategoryId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [priceCents, setPriceCents] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [serviceImageFile, setServiceImageFile] = useState<File | null>(null);

  async function refresh() {
    const token = getStoredToken();
    if (!token || !tenantId) {
      setCats([]);
      setServices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        listServiceCategories(token, { tenantId, branchId: effectiveBranchId }),
        listServices(token, { tenantId, branchId: effectiveBranchId }),
      ]);
      const cRows = (Array.isArray(c) ? c : []).map(asCat).filter((r) => r.id);
      setCats(cRows);
      const sRows = (Array.isArray(s) ? s : []).map(asService).filter((r) => r.id);
      setServices(sRows);
      if (!serviceCategoryId && cRows.length) {
        setServiceCategoryId(cRows[0].id);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, effectiveBranchId]);

  async function onCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    const token = getStoredToken();
    if (!token || !tenantId) return;
    setPending(true);
    try {
      await createServiceCategory(token, { tenantId, branchId: effectiveBranchId, name: catName });
      toast.success('Category created');
      setCatName('');
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Create failed');
    } finally {
      setPending(false);
    }
  }

  async function onCreateService(e: React.FormEvent) {
    e.preventDefault();
    const token = getStoredToken();
    if (!token || !tenantId || !serviceCategoryId) return;
    setPending(true);
    try {
      const d = durationMinutes ? Math.max(0, Math.floor(Number(durationMinutes) || 0)) : null;
      const p = priceCents ? Math.max(0, Math.floor(Number(priceCents) || 0)) : null;
      let imageUrl: string | undefined;
      if (serviceImageFile) {
        const up = await uploadBeautyServiceImage(token, { tenantId, branchId: effectiveBranchId }, serviceImageFile);
        imageUrl = up.path;
      }
      await createService(token, {
        tenantId,
        branchId: effectiveBranchId,
        categoryId: serviceCategoryId,
        name: serviceName,
        durationMinutes: d,
        priceCents: p,
        currency: p != null ? currency || 'USD' : null,
        ...(imageUrl ? { imageUrl } : {}),
      });
      toast.success('Service created');
      setServiceName('');
      setDurationMinutes('');
      setPriceCents('');
      setServiceImageFile(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Create failed');
    } finally {
      setPending(false);
    }
  }

  async function toggleCat(id: string, isActive: boolean | undefined) {
    const token = getStoredToken();
    if (!token) return;
    setPending(true);
    try {
      await patchServiceCategory(token, id, { isActive: !(isActive ?? true) });
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    } finally {
      setPending(false);
    }
  }

  async function toggleService(id: string, isActive: boolean | undefined) {
    const token = getStoredToken();
    if (!token) return;
    setPending(true);
    try {
      await patchService(token, id, { isAvailable: !(isActive ?? true) });
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Beauty & Grooming"
        title="Catalog"
        description="Create service categories and services. Use branch scope for branch-specific catalogs."
      />

      {!tenantId ? (
        <EmptyState icon="ph:scissors-duotone" title="Select a tenant" description="Choose a tenant in the top bar." />
      ) : null}

      {tenantId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scope</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bg-scope">Catalog scope</Label>
              <Select id="bg-scope" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
                <option value="branch">Selected branch</option>
                <option value="tenant">Tenant-wide</option>
              </Select>
              <p className="text-xs text-smoke-200">Branch scope uses the branch selected in the top bar.</p>
            </div>
            <div className="flex items-end justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading}>
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create category</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreateCategory} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bg-cat-name">Name</Label>
                <Input id="bg-cat-name" value={catName} onChange={(e) => setCatName(e.target.value)} required />
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Create category'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create service</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreateService} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bg-svc-cat">Category</Label>
                <Select id="bg-svc-cat" value={serviceCategoryId} onChange={(e) => setServiceCategoryId(e.target.value)}>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name ?? c.id.slice(0, 8)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bg-svc-name">Name</Label>
                <Input id="bg-svc-name" value={serviceName} onChange={(e) => setServiceName(e.target.value)} required />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bg-svc-duration">Duration (min, optional)</Label>
                  <Input id="bg-svc-duration" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bg-svc-price">Price (cents, optional)</Label>
                  <Input id="bg-svc-price" value={priceCents} onChange={(e) => setPriceCents(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bg-svc-curr">Currency</Label>
                <Input id="bg-svc-curr" value={currency} onChange={(e) => setCurrency(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bg-svc-img">Picha (hiari, JPEG/PNG/WebP/GIF)</Label>
                <Input
                  id="bg-svc-img"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => setServiceImageFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <Button type="submit" disabled={pending || cats.length === 0}>
                {pending ? 'Saving…' : 'Create service'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="font-display text-base font-semibold text-smoke-400">Categories</h3>
        {loading ? (
          <p className="text-sm text-smoke-200">Loading…</p>
        ) : cats.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Active</Th>
                <Th>Branch</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id}>
                  <Td className="font-medium text-smoke-400">{c.name ?? '—'}</Td>
                  <Td>{c.isActive === false ? 'No' : 'Yes'}</Td>
                  <Td className="font-mono text-xs">{c.branchId ? c.branchId.slice(0, 8) : '—'}</Td>
                  <Td className="text-right">
                    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void toggleCat(c.id, c.isActive)}>
                      Toggle
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon="ph:list-checks-duotone" title="No categories" description="Create a service category first." />
        )}
      </div>

      <div className="space-y-4">
        <h3 className="font-display text-base font-semibold text-smoke-400">Services</h3>
        {loading ? (
          <p className="text-sm text-smoke-200">Loading…</p>
        ) : services.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Img</Th>
                <Th>Name</Th>
                <Th>Active</Th>
                <Th>Duration</Th>
                <Th>Price</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {services.map((s) => {
                const imgSrc = apiMediaUrl(s.imageUrl);
                return (
                <tr key={s.id}>
                  <Td className="w-14">
                    {imgSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgSrc} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <span className="text-xs text-smoke-200">—</span>
                    )}
                  </Td>
                  <Td className="font-medium text-smoke-400">{s.name ?? '—'}</Td>
                  <Td>{s.isActive === false ? 'No' : 'Yes'}</Td>
                  <Td>{s.durationMin ?? '—'}</Td>
                  <Td className="font-mono text-xs">
                    {s.priceCents != null ? `${s.priceCents} ${s.currency ?? ''}` : 'On request'}
                  </Td>
                  <Td className="text-right">
                    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void toggleService(s.id, s.isActive)}>
                      Toggle
                    </Button>
                  </Td>
                </tr>
              );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon="ph:scissors-duotone" title="No services" description="Create services after categories." />
        )}
      </div>
    </div>
  );
}

