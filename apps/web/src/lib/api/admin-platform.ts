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
  amountCents: number;
  currency: string;
  periodLabel?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  effectiveDate?: string;
  paidAt?: string | null;
  notes?: string | null;
  createdAt?: string;
  tenant?: { id: string; name: string; status?: string };
  branch?: { id: string; name: string } | null;
  staff?: { id: string; displayName: string; email?: string | null };
};

export function adminListCompensations(
  token: string,
  params: {
    tenantId?: string;
    branchId?: string;
    status?: string;
    type?: string;
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
      q: params.q,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
    })}`,
    { token },
  );
}
