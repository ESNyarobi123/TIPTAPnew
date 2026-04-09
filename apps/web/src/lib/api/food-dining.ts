import { apiFetch } from './client';
import { toQueryString } from './query';

export type CreateMenuCategoryBody = {
  tenantId: string;
  branchId?: string | null;
  name: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type PatchMenuCategoryBody = Partial<Omit<CreateMenuCategoryBody, 'tenantId'>>;

export type CreateMenuItemBody = {
  tenantId: string;
  branchId?: string | null;
  categoryId: string;
  name: string;
  description?: string | null;
  priceCents: number;
  currency?: string | null;
  isAvailable?: boolean;
  displayOrder?: number;
  imageUrl?: string | null;
};

export type PatchMenuItemBody = Partial<Omit<CreateMenuItemBody, 'tenantId'>>;

export type CreateTableBody = {
  tenantId: string;
  branchId: string;
  code: string;
  label?: string | null;
  capacity?: number | null;
  status?: string;
  isActive?: boolean;
};

export type PatchTableBody = Partial<Omit<CreateTableBody, 'tenantId'>>;

export function listMenuCategories(token: string, params: { tenantId: string; branchId?: string | null; activeOnly?: boolean }) {
  return apiFetch<unknown[]>(
    `/food-dining/menu-categories${toQueryString({
      tenantId: params.tenantId,
      branchId: params.branchId ?? undefined,
      activeOnly: params.activeOnly ? '1' : undefined,
    })}`,
    { token },
  );
}

export function createMenuCategory(token: string, body: CreateMenuCategoryBody) {
  return apiFetch<unknown>('/food-dining/menu-categories', { method: 'POST', token, json: body });
}

export function patchMenuCategory(token: string, id: string, body: PatchMenuCategoryBody) {
  return apiFetch<unknown>(`/food-dining/menu-categories/${encodeURIComponent(id)}`, { method: 'PATCH', token, json: body });
}

export function listMenuItems(
  token: string,
  params: { tenantId: string; branchId?: string | null; categoryId?: string | null; activeOnly?: boolean },
) {
  return apiFetch<unknown[]>(
    `/food-dining/menu-items${toQueryString({
      tenantId: params.tenantId,
      branchId: params.branchId ?? undefined,
      categoryId: params.categoryId ?? undefined,
      activeOnly: params.activeOnly ? '1' : undefined,
    })}`,
    { token },
  );
}

export function createMenuItem(token: string, body: CreateMenuItemBody) {
  return apiFetch<unknown>('/food-dining/menu-items', { method: 'POST', token, json: body });
}

export function patchMenuItem(token: string, id: string, body: PatchMenuItemBody) {
  return apiFetch<unknown>(`/food-dining/menu-items/${encodeURIComponent(id)}`, { method: 'PATCH', token, json: body });
}

/** Multipart upload; returns `path` to save as `imageUrl` on the menu item (under `/api/v1`). */
export function uploadMenuItemImage(
  token: string,
  params: { tenantId: string; branchId?: string | null },
  file: File,
) {
  const fd = new FormData();
  fd.append('file', file);
  return apiFetch<{ path: string; url: string }>(
    `/food-dining/menu-items/upload${toQueryString({
      tenantId: params.tenantId,
      branchId: params.branchId ?? undefined,
    })}`,
    { method: 'POST', token, body: fd },
  );
}

export function listTables(token: string, params: { tenantId: string; branchId?: string | null }) {
  return apiFetch<unknown[]>(
    `/food-dining/tables${toQueryString({
      tenantId: params.tenantId,
      branchId: params.branchId ?? undefined,
    })}`,
    { token },
  );
}

export function createTable(token: string, body: CreateTableBody) {
  return apiFetch<unknown>('/food-dining/tables', { method: 'POST', token, json: body });
}

export function patchTable(token: string, id: string, body: PatchTableBody) {
  return apiFetch<unknown>(`/food-dining/tables/${encodeURIComponent(id)}`, { method: 'PATCH', token, json: body });
}

export function listWaiterCalls(
  token: string,
  params: { tenantId: string; branchId?: string | null; status?: string | null },
) {
  return apiFetch<unknown[]>(
    `/food-dining/waiter-calls${toQueryString({
      tenantId: params.tenantId,
      branchId: params.branchId ?? undefined,
      status: params.status ?? undefined,
    })}`,
    { token },
  );
}

export function patchWaiterCall(token: string, id: string, body: { status?: string; notes?: string | null }) {
  return apiFetch<unknown>(`/food-dining/waiter-calls/${encodeURIComponent(id)}`, { method: 'PATCH', token, json: body });
}

export function listBillRequests(
  token: string,
  params: { tenantId: string; branchId?: string | null; status?: string | null },
) {
  return apiFetch<unknown[]>(
    `/food-dining/bill-requests${toQueryString({
      tenantId: params.tenantId,
      branchId: params.branchId ?? undefined,
      status: params.status ?? undefined,
    })}`,
    { token },
  );
}

export function patchBillRequest(token: string, id: string, body: { status?: string; notes?: string | null }) {
  return apiFetch<unknown>(`/food-dining/bill-requests/${encodeURIComponent(id)}`, { method: 'PATCH', token, json: body });
}

export function listDiningOrders(
  token: string,
  params: { tenantId: string; branchId?: string | null; status?: string | null; staffId?: string | null },
) {
  return apiFetch<unknown[]>(
    `/food-dining/orders${toQueryString({
      tenantId: params.tenantId,
      branchId: params.branchId ?? undefined,
      status: params.status ?? undefined,
      staffId: params.staffId ?? undefined,
    })}`,
    { token },
  );
}

export function patchDiningOrder(
  token: string,
  id: string,
  body: { status?: string; notes?: string; taxCents?: number; paymentMethod?: string; paidAt?: string },
) {
  return apiFetch<unknown>(`/food-dining/orders/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token,
    json: body,
  });
}
