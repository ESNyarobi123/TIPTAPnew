'use client';

import { Icon } from '@iconify/react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { StatusChip } from '@/components/ui/status-chip';
import { Table, Td, Th } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import {
  adminListApprovals,
  adminUpdateApproval,
  type AdminApprovalRow,
} from '@/lib/api/admin-platform';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';

const workflowOptions = ['ALL', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED'] as const;
const riskOptions = ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const tenantStatusOptions = ['ALL', 'TRIAL', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const;
const checklistConfig = [
  { key: 'legalIdentityVerified', label: 'Identity', icon: 'fluent-color:person-key-20' },
  { key: 'contactVerified', label: 'Contact', icon: 'fluent-color:phone-checkmark-20' },
  { key: 'paymentReady', label: 'Payments', icon: 'fluent-color:wallet-credit-card-16' },
  { key: 'branchReady', label: 'Branch', icon: 'fluent-color:building-store-24' },
  { key: 'catalogReady', label: 'Catalog', icon: 'fluent-color:library-24' },
  { key: 'staffingReady', label: 'Staffing', icon: 'fluent-color:people-community-20' },
  { key: 'channelReady', label: 'Channel', icon: 'fluent-color:chat-multiple-heart-24' },
] as const;

type ChecklistKey = (typeof checklistConfig)[number]['key'];

type ReviewForm = {
  workflowStatus: string;
  riskLevel: string;
  reviewNotes: string;
  nextActions: string;
  tenantStatus?: string;
} & Record<ChecklistKey, boolean>;

function createForm(row: AdminApprovalRow | null): ReviewForm {
  return {
    workflowStatus: row?.approval.workflowStatus ?? 'PENDING',
    riskLevel: row?.approval.riskLevel ?? 'MEDIUM',
    reviewNotes: row?.approval.reviewNotes ?? '',
    nextActions: row?.approval.nextActions ?? '',
    tenantStatus: row?.status ?? 'TRIAL',
    legalIdentityVerified: row?.approval.checklist.legalIdentityVerified ?? false,
    contactVerified: row?.approval.checklist.contactVerified ?? false,
    paymentReady: row?.approval.checklist.paymentReady ?? false,
    branchReady: row?.approval.checklist.branchReady ?? false,
    catalogReady: row?.approval.checklist.catalogReady ?? false,
    staffingReady: row?.approval.checklist.staffingReady ?? false,
    channelReady: row?.approval.checklist.channelReady ?? false,
  };
}

export default function AdminApprovalsPage() {
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [rows, setRows] = useState<AdminApprovalRow[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    byTenantStatus: Record<string, number>;
    byWorkflowStatus: Record<string, number>;
    byRiskLevel: Record<string, number>;
    publishedLanding: number;
    withPaymentsReady: number;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [q, setQ] = useState('');
  const [tenantStatusFilter, setTenantStatusFilter] = useState<string>('ALL');
  const [workflowFilter, setWorkflowFilter] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [form, setForm] = useState<ReviewForm>(createForm(null));

  async function load() {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await adminListApprovals(token, {
        q: q || undefined,
        tenantStatus: tenantStatusFilter !== 'ALL' ? tenantStatusFilter : undefined,
        workflowStatus: workflowFilter !== 'ALL' ? workflowFilter : undefined,
        riskLevel: riskFilter !== 'ALL' ? riskFilter : undefined,
      });
      setRows(res.items ?? []);
      setSummary(res.summary ?? null);
      setSelectedId((prev) => {
        if (prev && (res.items ?? []).some((row) => row.id === prev)) {
          return prev;
        }
        return res.items?.[0]?.id ?? '';
      });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load approvals');
      setRows([]);
      setSummary(null);
      setSelectedId('');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [q, tenantStatusFilter, workflowFilter, riskFilter]);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? rows[0] ?? null,
    [rows, selectedId],
  );

  useEffect(() => {
    setForm(createForm(selected));
  }, [selected?.id]);

  async function submitReview(actionLabel: string, patch?: Partial<ReviewForm>) {
    const token = getStoredToken();
    if (!token || !selected) {
      return;
    }
    const next = { ...form, ...patch };
    setPendingAction(actionLabel);
    try {
      await adminUpdateApproval(token, selected.id, {
        workflowStatus: next.workflowStatus,
        riskLevel: next.riskLevel,
        tenantStatus: next.tenantStatus,
        reviewNotes: next.reviewNotes,
        nextActions: next.nextActions,
        legalIdentityVerified: next.legalIdentityVerified,
        contactVerified: next.contactVerified,
        paymentReady: next.paymentReady,
        branchReady: next.branchReady,
        catalogReady: next.catalogReady,
        staffingReady: next.staffingReady,
        channelReady: next.channelReady,
      });
      toast.success(actionLabel);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to update approval');
    } finally {
      setPendingAction(null);
    }
  }

  if (!getStoredToken()) {
    return (
      <EmptyState
        variant="premium"
        icon="fluent-color:lock-shield-24"
        title="Sign in required"
        description="Sign in to manage approvals."
      />
    );
  }

  const queueRows = rows;

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="platform"
        eyebrow="Governance desk"
        title="Merchant approvals"
        description="Review trial workspaces, score readiness, and move merchants into live operations."
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard icon="fluent-color:approvals-app-24" label="Queue" value={summary?.total ?? 0} />
          <StatCard icon="fluent-color:hourglass-half-24" label="Pending" value={summary?.byWorkflowStatus?.PENDING ?? 0} />
          <StatCard icon="fluent-color:person-search-24" label="Under review" value={summary?.byWorkflowStatus?.UNDER_REVIEW ?? 0} />
          <StatCard icon="fluent-color:checkmark-circle-24" label="Approved" value={summary?.byWorkflowStatus?.APPROVED ?? 0} />
          <StatCard icon="fluent-color:wallet-credit-card-16" label="Payment ready" value={summary?.withPaymentsReady ?? 0} />
        </div>
      )}

      <Card className="border-smoke-400/10 shadow-card">
        <CardContent className="pt-6">
          <FilterBar>
            <div className="space-y-1">
              <Label htmlFor="approval-q">Search</Label>
              <Input
                id="approval-q"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="tenant, slug, contact"
                className="h-10 min-w-[14rem]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="approval-status">Tenant</Label>
              <Select id="approval-status" value={tenantStatusFilter} onChange={(event) => setTenantStatusFilter(event.target.value)}>
                {tenantStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'ALL' ? 'All' : option.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="approval-workflow">Workflow</Label>
              <Select id="approval-workflow" value={workflowFilter} onChange={(event) => setWorkflowFilter(event.target.value)}>
                {workflowOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'ALL' ? 'All' : option.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="approval-risk">Risk</Label>
              <Select id="approval-risk" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
                {riskOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'ALL' ? 'All' : option}
                  </option>
                ))}
              </Select>
            </div>
          </FilterBar>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-smoke-400/10 shadow-card">
          <CardHeader className="border-b border-smoke-400/[0.06]">
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon icon="fluent-color:task-list-square-ltr-20" className="h-5 w-5" aria-hidden />
              Approval queue
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 rounded-xl" />
                ))}
              </div>
            ) : queueRows.length === 0 ? (
              <EmptyState
                variant="premium"
                icon="fluent-color:checkmark-starburst-24"
                title="Queue is clear"
                description="No merchants match this review lens."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Merchant</Th>
                    <Th>Workflow</Th>
                    <Th>Risk</Th>
                    <Th>Readiness</Th>
                    <Th>Lane</Th>
                  </tr>
                </thead>
                <tbody>
                  {queueRows.map((row) => (
                    <tr
                      key={row.id}
                      className={row.id === selected?.id ? 'bg-violet-50/30' : undefined}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <Td>
                        <div className="space-y-1">
                          <p className="font-medium text-smoke-400">{row.name}</p>
                          <p className="text-xs text-smoke-200">
                            {row.owner?.email ?? row.email ?? row.slug}
                          </p>
                        </div>
                      </Td>
                      <Td>
                        <StatusChip status={row.approval.workflowStatus} />
                      </Td>
                      <Td>
                        <Badge
                          variant={
                            row.approval.riskLevel === 'LOW'
                              ? 'success'
                              : row.approval.riskLevel === 'MEDIUM'
                                ? 'warning'
                                : 'danger'
                          }
                        >
                          {row.approval.riskLevel}
                        </Badge>
                      </Td>
                      <Td className="text-xs font-medium text-smoke-400">
                        {row.approval.readinessCompleted}/{row.approval.readinessTotal}
                      </Td>
                      <Td className="text-xs text-smoke-200">
                        {row.categories.join(' · ') || 'No category'}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {!selected ? (
            <EmptyState
              variant="premium"
              icon="fluent-color:panel-left-contract-24"
              title="Select a merchant"
              description="Approval detail will open here."
            />
          ) : (
            <>
              <Card className="border-smoke-400/10 shadow-card">
                <CardHeader className="border-b border-smoke-400/[0.06]">
                  <CardTitle className="flex items-center justify-between gap-3 text-base">
                    <span>{selected.name}</span>
                    <StatusChip status={selected.status} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-smoke-400/[0.07] bg-ivory-50/90 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-smoke-200">Owner</p>
                      <p className="mt-2 text-sm font-medium text-smoke-400">{selected.owner?.name ?? 'Unassigned'}</p>
                      <p className="mt-1 text-xs text-smoke-200">{selected.owner?.email ?? selected.email ?? 'No contact yet'}</p>
                    </div>
                    <div className="rounded-2xl border border-smoke-400/[0.07] bg-ivory-50/90 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-smoke-200">Workspace</p>
                      <p className="mt-2 text-sm font-medium text-smoke-400">{selected.slug}</p>
                      <p className="mt-1 text-xs text-smoke-200">
                        {selected.branchesPreview[0]?.name ?? 'No branch'} · {selected.categories.join(' · ') || 'No category'}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-smoke-400/[0.07] bg-ivory-50/90 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-smoke-200">Branches</p>
                      <p className="mt-2 text-lg font-semibold text-smoke-400">{selected.counts.branches}</p>
                    </div>
                    <div className="rounded-2xl border border-smoke-400/[0.07] bg-ivory-50/90 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-smoke-200">Staff</p>
                      <p className="mt-2 text-lg font-semibold text-smoke-400">{selected.counts.staff}</p>
                    </div>
                    <div className="rounded-2xl border border-smoke-400/[0.07] bg-ivory-50/90 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-smoke-200">Payments</p>
                      <p className="mt-2 text-lg font-semibold text-smoke-400">{selected.counts.paymentConfigs}</p>
                    </div>
                    <div className="rounded-2xl border border-smoke-400/[0.07] bg-ivory-50/90 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-smoke-200">Landing</p>
                      <p className="mt-2 text-lg font-semibold text-smoke-400">
                        {selected.landing?.isPublished ? 'Live' : 'Draft'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-smoke-400/10 shadow-card">
                <CardHeader className="border-b border-smoke-400/[0.06]">
                  <CardTitle className="flex items-center justify-between gap-3 text-base">
                    <span>Review controls</span>
                    <Badge variant={form.riskLevel === 'LOW' ? 'success' : form.riskLevel === 'MEDIUM' ? 'warning' : 'danger'}>
                      {selected.approval.readinessPercent}% ready
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 pt-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="workflow">Workflow</Label>
                      <Select
                        id="workflow"
                        value={form.workflowStatus}
                        onChange={(event) => setForm((current) => ({ ...current, workflowStatus: event.target.value }))}
                      >
                        {workflowOptions.filter((option) => option !== 'ALL').map((option) => (
                          <option key={option} value={option}>
                            {option.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="risk">Risk</Label>
                      <Select
                        id="risk"
                        value={form.riskLevel}
                        onChange={(event) => setForm((current) => ({ ...current, riskLevel: event.target.value }))}
                      >
                        {riskOptions.filter((option) => option !== 'ALL').map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {checklistConfig.map((item) => {
                      const active = form[item.key];
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setForm((current) => ({ ...current, [item.key]: !current[item.key] }))}
                          className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                            active
                              ? 'border-emerald-500/30 bg-emerald-500/8'
                              : 'border-smoke-400/[0.08] bg-ivory-50/80 hover:border-smoke-400/16'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon icon={item.icon} className="h-6 w-6" aria-hidden />
                            <span className="text-sm font-medium text-smoke-400">{item.label}</span>
                          </div>
                          <Badge variant={active ? 'success' : 'neutral'}>{active ? 'Ready' : 'Hold'}</Badge>
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="review-notes">Review notes</Label>
                    <Textarea
                      id="review-notes"
                      value={form.reviewNotes}
                      onChange={(event) => setForm((current) => ({ ...current, reviewNotes: event.target.value }))}
                      placeholder="Internal review summary"
                      className="min-h-[120px]"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="next-actions">Next actions</Label>
                    <Textarea
                      id="next-actions"
                      value={form.nextActions}
                      onChange={(event) => setForm((current) => ({ ...current, nextActions: event.target.value }))}
                      placeholder="What the merchant still needs to finish"
                      className="min-h-[96px]"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={pendingAction != null}
                      onClick={() => void submitReview('Review saved')}
                    >
                      {pendingAction === 'Review saved' ? 'Saving…' : 'Save review'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-smoke-400/18"
                      disabled={pendingAction != null}
                      onClick={() =>
                        void submitReview('Moved to review', { workflowStatus: 'UNDER_REVIEW', tenantStatus: selected.status })
                      }
                    >
                      Under review
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-amber-500/30 bg-amber-500/8 text-amber-950"
                      disabled={pendingAction != null}
                      onClick={() =>
                        void submitReview('Changes requested', {
                          workflowStatus: 'CHANGES_REQUESTED',
                          tenantStatus: 'TRIAL',
                        })
                      }
                    >
                      Request changes
                    </Button>
                    <Button
                      type="button"
                      className="bg-emerald-700 text-ivory-100 hover:bg-emerald-600"
                      disabled={pendingAction != null}
                      onClick={() =>
                        void submitReview('Merchant approved', {
                          workflowStatus: 'APPROVED',
                          tenantStatus: 'ACTIVE',
                        })
                      }
                    >
                      Approve & activate
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-rose-500/30 bg-rose-500/8 text-rose-950"
                      disabled={pendingAction != null}
                      onClick={() =>
                        void submitReview('Merchant archived', {
                          workflowStatus: 'REJECTED',
                          tenantStatus: 'ARCHIVED',
                        })
                      }
                    >
                      Reject / archive
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
