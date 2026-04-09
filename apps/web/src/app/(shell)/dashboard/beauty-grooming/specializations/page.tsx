'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { Table, Td, Th } from '@/components/ui/table';
import { ApiError } from '@/lib/api/client';
import { createSpecialization, listSpecializations } from '@/lib/api/beauty-grooming';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

type SpecRow = { id: string; staffId?: string; title?: string; beautyServiceId?: string | null; beautyServiceCategoryId?: string | null };

function asRow(x: unknown): SpecRow {
  const o = (x ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    staffId: typeof o.staffId === 'string' ? o.staffId : undefined,
    title: typeof o.title === 'string' ? o.title : undefined,
    beautyServiceId: typeof o.beautyServiceId === 'string' ? o.beautyServiceId : (o.beautyServiceId === null ? null : undefined),
    beautyServiceCategoryId: typeof o.beautyServiceCategoryId === 'string' ? o.beautyServiceCategoryId : (o.beautyServiceCategoryId === null ? null : undefined),
  };
}

export default function BeautySpecializationsPage() {
  const { tenantId } = useScope();
  const [rows, setRows] = useState<SpecRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [title, setTitle] = useState('');
  const [beautyServiceCategoryId, setBeautyServiceCategoryId] = useState('');
  const [beautyServiceId, setBeautyServiceId] = useState('');

  async function refresh() {
    const token = getStoredToken();
    if (!token || !tenantId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await listSpecializations(token, { tenantId });
      setRows((Array.isArray(list) ? list : []).map(asRow).filter((r) => r.id));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load specializations');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const token = getStoredToken();
    if (!token || !tenantId) return;
    setPending(true);
    try {
      await createSpecialization(token, {
        tenantId,
        staffId,
        title,
        beautyServiceCategoryId: beautyServiceCategoryId || null,
        beautyServiceId: beautyServiceId || null,
      });
      toast.success('Specialization created');
      setTitle('');
      setBeautyServiceCategoryId('');
      setBeautyServiceId('');
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Create failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Beauty & Grooming"
        title="Specializations"
        description="Link a staff member to skills or specific services. Use staffId from the Staff page."
      />

      {!tenantId ? (
        <EmptyState icon="ph:certificate-duotone" title="Select a tenant" description="Choose a tenant in the top bar." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create specialization</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="sp-staff">Staff ID</Label>
                <Input id="sp-staff" value={staffId} onChange={(e) => setStaffId(e.target.value)} required placeholder="cuid staffId" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="sp-title">Title</Label>
                <Input id="sp-title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Braids, Fade haircut, Facial" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sp-cat">Beauty service category ID (optional)</Label>
                <Input id="sp-cat" value={beautyServiceCategoryId} onChange={(e) => setBeautyServiceCategoryId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sp-svc">Beauty service ID (optional)</Label>
                <Input id="sp-svc" value={beautyServiceId} onChange={(e) => setBeautyServiceId(e.target.value)} />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <Button type="submit" disabled={pending || !staffId || !title}>
                  {pending ? 'Saving…' : 'Create'}
                </Button>
                <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading}>
                  Refresh
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h3 className="font-display text-base font-semibold text-smoke-400">Specializations</h3>
        {loading ? (
          <p className="text-sm text-smoke-200">Loading…</p>
        ) : rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Title</Th>
                <Th>Staff</Th>
                <Th>Category link</Th>
                <Th>Service link</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className="font-medium text-smoke-400">{r.title ?? '—'}</Td>
                  <Td className="font-mono text-xs">{r.staffId ? r.staffId.slice(0, 8) : '—'}</Td>
                  <Td className="font-mono text-xs">{r.beautyServiceCategoryId ? r.beautyServiceCategoryId.slice(0, 8) : '—'}</Td>
                  <Td className="font-mono text-xs">{r.beautyServiceId ? r.beautyServiceId.slice(0, 8) : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon="ph:certificate-duotone" title="No specializations" description="Create one to start linking staff skills to services." />
        )}
      </div>
    </div>
  );
}

