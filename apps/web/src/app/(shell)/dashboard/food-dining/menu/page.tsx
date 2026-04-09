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
  createMenuCategory,
  createMenuItem,
  listMenuCategories,
  listMenuItems,
  patchMenuCategory,
  patchMenuItem,
  uploadMenuItemImage,
} from '@/lib/api/food-dining';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

type CatRow = { id: string; name?: string; branchId?: string | null; isActive?: boolean; sortOrder?: number };
type ItemRow = {
  id: string;
  name?: string;
  categoryId?: string;
  priceCents?: number;
  currency?: string;
  isAvailable?: boolean;
  branchId?: string | null;
  imageUrl?: string | null;
};

function asCat(x: unknown): CatRow {
  const o = (x ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    name: typeof o.name === 'string' ? o.name : undefined,
    branchId: typeof o.branchId === 'string' ? o.branchId : (o.branchId === null ? null : undefined),
    isActive: typeof o.isActive === 'boolean' ? o.isActive : undefined,
    sortOrder: typeof o.sortOrder === 'number' ? o.sortOrder : undefined,
  };
}

function asItem(x: unknown): ItemRow {
  const o = (x ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    name: typeof o.name === 'string' ? o.name : undefined,
    categoryId: typeof o.categoryId === 'string' ? o.categoryId : undefined,
    priceCents: typeof o.priceCents === 'number' ? o.priceCents : undefined,
    currency: typeof o.currency === 'string' ? o.currency : undefined,
    isAvailable: typeof o.isAvailable === 'boolean' ? o.isAvailable : undefined,
    branchId: typeof o.branchId === 'string' ? o.branchId : (o.branchId === null ? null : undefined),
    imageUrl: typeof o.imageUrl === 'string' ? o.imageUrl : (o.imageUrl === null ? null : undefined),
  };
}

export default function FoodDiningMenuPage() {
  const { tenantId, branchId } = useScope();
  const [cats, setCats] = useState<CatRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  const [scope, setScope] = useState<'tenant' | 'branch'>('branch');

  const [catName, setCatName] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('0');
  const [itemCurrency, setItemCurrency] = useState('USD');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemImageFile, setItemImageFile] = useState<File | null>(null);

  const effectiveBranchId = useMemo(() => (scope === 'branch' ? branchId : null), [scope, branchId]);

  async function refresh() {
    const token = getStoredToken();
    if (!token || !tenantId) {
      setCats([]);
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [c, i] = await Promise.all([
        listMenuCategories(token, { tenantId, branchId: effectiveBranchId }),
        listMenuItems(token, { tenantId, branchId: effectiveBranchId }),
      ]);
      const catRows = (Array.isArray(c) ? c : []).map(asCat).filter((r) => r.id);
      setCats(catRows);
      const itemRows = (Array.isArray(i) ? i : []).map(asItem).filter((r) => r.id);
      setItems(itemRows);
      if (!itemCategoryId && catRows.length) {
        setItemCategoryId(catRows[0].id);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load menu');
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
      await createMenuCategory(token, {
        tenantId,
        branchId: effectiveBranchId,
        name: catName,
      });
      toast.success('Category created');
      setCatName('');
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Create failed');
    } finally {
      setPending(false);
    }
  }

  async function onCreateItem(e: React.FormEvent) {
    e.preventDefault();
    const token = getStoredToken();
    if (!token || !tenantId || !itemCategoryId) return;
    setPending(true);
    try {
      let imageUrl: string | undefined;
      if (itemImageFile) {
        const up = await uploadMenuItemImage(token, { tenantId, branchId: effectiveBranchId }, itemImageFile);
        imageUrl = up.path;
      }
      await createMenuItem(token, {
        tenantId,
        branchId: effectiveBranchId,
        categoryId: itemCategoryId,
        name: itemName,
        priceCents: Math.max(0, Math.floor(Number(itemPrice) || 0)),
        currency: itemCurrency || 'USD',
        ...(imageUrl ? { imageUrl } : {}),
      });
      toast.success('Item created');
      setItemName('');
      setItemPrice('0');
      setItemImageFile(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Create failed');
    } finally {
      setPending(false);
    }
  }

  async function toggleCatActive(id: string, isActive: boolean | undefined) {
    const token = getStoredToken();
    if (!token) return;
    setPending(true);
    try {
      await patchMenuCategory(token, id, { isActive: !(isActive ?? true) });
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    } finally {
      setPending(false);
    }
  }

  async function toggleItemAvailable(id: string, isAvailable: boolean | undefined) {
    const token = getStoredToken();
    if (!token) return;
    setPending(true);
    try {
      await patchMenuItem(token, id, { isAvailable: !(isAvailable ?? true) });
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
        eyebrow="Food & Dining"
        title="Menu"
        description="Create categories and items. Use branch scope for branch-specific menus."
      />

      {!tenantId ? (
        <EmptyState icon="ph:list-checks-duotone" title="Select a tenant" description="Choose a tenant in the top bar." />
      ) : null}

      {tenantId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scope</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fd-scope">Menu scope</Label>
              <Select id="fd-scope" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
                <option value="branch">Selected branch</option>
                <option value="tenant">Tenant-wide</option>
              </Select>
              <p className="text-xs text-smoke-200">
                Branch scope uses the branch selected in the top bar; tenant-wide ignores branch.
              </p>
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
                <Label htmlFor="fd-cat-name">Name</Label>
                <Input id="fd-cat-name" value={catName} onChange={(e) => setCatName(e.target.value)} required />
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Create category'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create item</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreateItem} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fd-item-cat">Category</Label>
                <Select id="fd-item-cat" value={itemCategoryId} onChange={(e) => setItemCategoryId(e.target.value)}>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name ?? c.id.slice(0, 8)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fd-item-name">Name</Label>
                <Input id="fd-item-name" value={itemName} onChange={(e) => setItemName(e.target.value)} required />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fd-item-price">Price (minor units)</Label>
                  <Input id="fd-item-price" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fd-item-curr">Currency</Label>
                  <Input id="fd-item-curr" value={itemCurrency} onChange={(e) => setItemCurrency(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fd-item-img">Picha (hiari, JPEG/PNG/WebP/GIF, max ~5MB)</Label>
                <Input
                  id="fd-item-img"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => setItemImageFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <Button type="submit" disabled={pending || cats.length === 0}>
                {pending ? 'Saving…' : 'Create item'}
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
                    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void toggleCatActive(c.id, c.isActive)}>
                      Toggle
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon="ph:list-checks-duotone" title="No categories" description="Create a menu category first." />
        )}
      </div>

      <div className="space-y-4">
        <h3 className="font-display text-base font-semibold text-smoke-400">Items</h3>
        {loading ? (
          <p className="text-sm text-smoke-200">Loading…</p>
        ) : items.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Img</Th>
                <Th>Name</Th>
                <Th>Available</Th>
                <Th>Price</Th>
                <Th>Category</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const imgSrc = apiMediaUrl(i.imageUrl);
                return (
                <tr key={i.id}>
                  <Td className="w-14">
                    {imgSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgSrc} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <span className="text-xs text-smoke-200">—</span>
                    )}
                  </Td>
                  <Td className="font-medium text-smoke-400">{i.name ?? '—'}</Td>
                  <Td>{i.isAvailable === false ? 'No' : 'Yes'}</Td>
                  <Td className="font-mono text-xs">
                    {(i.priceCents ?? 0).toString()} {i.currency ?? ''}
                  </Td>
                  <Td className="font-mono text-xs">{i.categoryId ? i.categoryId.slice(0, 8) : '—'}</Td>
                  <Td className="text-right">
                    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void toggleItemAvailable(i.id, i.isAvailable)}>
                      Toggle
                    </Button>
                  </Td>
                </tr>
              );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon="ph:bowl-food-duotone" title="No items" description="Create menu items after categories." />
        )}
      </div>
    </div>
  );
}

