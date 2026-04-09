import { apiFetch } from './client';
import { toQueryString } from './query';

export type AdminStaffRow = {
  id: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  roleInTenant: string;
  status: string;
  publicHandle?: string | null;
  hireDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  tenant?: { id: string; name: string; status?: string };
  branch?: { id: string; name: string } | null;
  providerProfile?: { id: string; registryCode?: string | null; publicSlug?: string | null } | null;
};

export type AdminDiningOrderRow = {
  id: string;
  tenantId: string;
  branchId: string;
  orderNumber: string;
  status: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  customerPhone?: string | null;
  createdAt?: string;
  updatedAt?: string;
  tenant?: { id: string; name: string; status?: string };
  branch?: { id: string; name: string };
  staff?: { id: string; displayName: string } | null;
};

export function adminListStaff(
  token: string,
  params: { tenantId?: string; q?: string; page?: number; pageSize?: number },
) {
  return apiFetch<{ items: AdminStaffRow[]; total: number; page: number; pageSize: number }>(
    `/admin/staff${toQueryString({
      tenantId: params.tenantId,
      q: params.q,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
    })}`,
    { token },
  );
}

export function adminListDiningOrders(
  token: string,
  params: {
    tenantId?: string;
    branchId?: string;
    status?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  },
) {
  return apiFetch<{ items: AdminDiningOrderRow[]; total: number; page: number; pageSize: number }>(
    `/admin/dining-orders${toQueryString({
      tenantId: params.tenantId,
      branchId: params.branchId,
      status: params.status,
      q: params.q,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
    })}`,
    { token },
  );
}

export type AdminBeautyBookingRow = {
  id: string;
  tenantId: string;
  branchId: string;
  stationId?: string | null;
  bookingNumber: string;
  status: string;
  scheduledAt?: string | null;
  checkedInAt?: string | null;
  totalCents: number;
  currency: string;
  customerPhone?: string | null;
  customerName?: string | null;
  isWalkIn: boolean;
  createdAt?: string;
  updatedAt?: string;
  tenant?: { id: string; name: string; status?: string };
  branch?: { id: string; name: string };
  station?: { id: string; code: string; label?: string | null } | null;
  staff?: { id: string; displayName: string } | null;
};

export function adminListBeautyBookings(
  token: string,
  params: {
    tenantId?: string;
    branchId?: string;
    status?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  },
) {
  return apiFetch<{ items: AdminBeautyBookingRow[]; total: number; page: number; pageSize: number }>(
    `/admin/beauty-bookings${toQueryString({
      tenantId: params.tenantId,
      branchId: params.branchId,
      status: params.status,
      q: params.q,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
    })}`,
    { token },
  );
}

export type AdminCompensationRow = {
  id: string;
  tenantId: string;
  branchId?: string | null;
  staffId: string;
  type: string;
  status: string;
  lineKind?: string | null;
  label?: string | null;
  sourceReference?: string | null;
  amountCents: number;
  currency: string;
  periodLabel?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  effectiveDate?: string;
  paidAt?: string | null;
  payrollRunId?: string | null;
  payrollSlipId?: string | null;
  lockedAt?: string | null;
  notes?: string | null;
  createdAt?: string;
  tenant?: { id: string; name: string; status?: string };
  branch?: { id: string; name: string } | null;
  payrollSlip?: {
    id: string;
    slipNumber: string;
    status: string;
    netCents: number;
  } | null;
  payrollRun?: {
    id: string;
    status: string;
    periodLabel: string;
  } | null;
  staff?: { id: string; displayName: string; email?: string | null };
};

export function adminListCompensations(
  token: string,
  params: {
    tenantId?: string;
      branchId?: string;
      status?: string;
      type?: string;
      lineKind?: string;
      q?: string;
      page?: number;
      pageSize?: number;
  },
) {
  return apiFetch<{ items: AdminCompensationRow[]; total: number; page: number; pageSize: number }>(
    `/admin/compensations${toQueryString({
      tenantId: params.tenantId,
      branchId: params.branchId,
      status: params.status,
      type: params.type,
      lineKind: params.lineKind,
      q: params.q,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
    })}`,
    { token },
  );
}

export type AdminApprovalChecklist = {
  legalIdentityVerified: boolean;
  contactVerified: boolean;
  paymentReady: boolean;
  branchReady: boolean;
  catalogReady: boolean;
  staffingReady: boolean;
  channelReady: boolean;
};

export type AdminApprovalRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt?: string;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  subscriptionPlan?: string | null;
  subscriptionStatus?: string | null;
  categories: string[];
  owner?: { id: string; name: string; email: string; phone?: string | null } | null;
  branchesPreview: Array<{ id: string; name: string; code: string }>;
  counts: {
    branches: number;
    staff: number;
    paymentConfigs: number;
    diningOrders: number;
    beautyBookings: number;
  };
  landing?: { isPublished: boolean; slug: string; updatedAt?: string } | null;
  approval: {
    workflowStatus: string;
    riskLevel: string;
    assignedReviewerUserId?: string | null;
    reviewedByUserId?: string | null;
    reviewNotes?: string | null;
    nextActions?: string | null;
    requestedAt?: string | null;
    submittedAt?: string | null;
    lastReviewedAt?: string | null;
    approvedAt?: string | null;
    rejectedAt?: string | null;
    changesRequestedAt?: string | null;
    checklist: AdminApprovalChecklist;
    readinessCompleted: number;
    readinessTotal: number;
    readinessPercent: number;
    timeline?: Array<Record<string, unknown>>;
  };
};

export type AdminApprovalsResponse = {
  summary: {
    total: number;
    byTenantStatus: Record<string, number>;
    byWorkflowStatus: Record<string, number>;
    byRiskLevel: Record<string, number>;
    publishedLanding: number;
    withPaymentsReady: number;
  };
  items: AdminApprovalRow[];
};

export function adminListApprovals(
  token: string,
  params: {
    q?: string;
    tenantStatus?: string;
    workflowStatus?: string;
    riskLevel?: string;
  },
) {
  return apiFetch<AdminApprovalsResponse>(
    `/admin/approvals${toQueryString({
      q: params.q,
      tenantStatus: params.tenantStatus,
      workflowStatus: params.workflowStatus,
      riskLevel: params.riskLevel,
    })}`,
    { token },
  );
}

export function adminUpdateApproval(
  token: string,
  tenantId: string,
  body: Record<string, unknown>,
) {
  return apiFetch<unknown>(`/admin/approvals/${encodeURIComponent(tenantId)}`, {
    method: 'PATCH',
    token,
    json: body,
  });
}

export type AdminOrderCenterRow = {
  id: string;
  kind: 'DINING_ORDER' | 'BEAUTY_BOOKING' | 'LEDGER_ONLY';
  vertical: 'FOOD_DINING' | 'BEAUTY_GROOMING' | 'LEDGER_ONLY';
  reference: string;
  workflowStatus: string;
  paymentStatus: string;
  commercialStatus: string;
  amountCents: number;
  currency: string;
  customerLabel?: string | null;
  staffLabel?: string | null;
  tenant: { id: string; name: string; status?: string | null };
  branch?: { id: string; name?: string | null } | null;
  payment?: {
    id: string;
    orderReference: string;
    externalRef?: string | null;
    status: string;
    type: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminOrderCenterResponse = {
  summary: {
    total: number;
    byKind: Record<string, number>;
    byCommercialStatus: Record<string, number>;
    byPaymentStatus: Record<string, number>;
    grossCents: number;
  };
  items: AdminOrderCenterRow[];
  total: number;
  page: number;
  pageSize: number;
  windowed?: boolean;
};

export function adminGetOrderCenter(
  token: string,
  params: {
    tenantId?: string;
    branchId?: string;
    kind?: string;
    workflowStatus?: string;
    paymentStatus?: string;
    commercialStatus?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  },
) {
  return apiFetch<AdminOrderCenterResponse>(
    `/admin/order-center${toQueryString({
      tenantId: params.tenantId,
      branchId: params.branchId,
      kind: params.kind,
      workflowStatus: params.workflowStatus,
      paymentStatus: params.paymentStatus,
      commercialStatus: params.commercialStatus,
      q: params.q,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
    })}`,
    { token },
  );
}
