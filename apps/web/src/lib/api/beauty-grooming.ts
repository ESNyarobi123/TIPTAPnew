import { apiFetch } from './client';
import { toQueryString } from './query';

export type CreateServiceCategoryBody = {
  tenantId: string;
  branchId?: string | null;
  name: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type PatchServiceCategoryBody = Partial<Omit<CreateServiceCategoryBody, 'tenantId'>>;

export type CreateBeautyServiceBody = {
  tenantId: string;
  branchId?: string | null;
  categoryId: string;
  name: string;
  description?: string | null;
  durationMinutes?: number | null;
  priceCents?: number | null;
  currency?: string | null;
  imageUrl?: string | null;
  displayOrder?: number | null;
  isAvailable?: boolean;
};

export type PatchBeautyServiceBody = Partial<Omit<CreateBeautyServiceBody, 'tenantId'>>;

export type CreateBeautyStationBody = {
  tenantId: string;
  branchId: string;
  code: string;
  label?: string | null;
  status?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export type PatchBeautyStationBody = Partial<Omit<CreateBeautyStationBody, 'tenantId'>>;

export type CreateSpecializationBody = {
  tenantId: string;
  staffId: string;
  title: string;
  description?: string | null;
  beautyServiceCategoryId?: string | null;
  beautyServiceId?: string | null;
};

export type PatchSpecializationBody = Partial<Omit<CreateSpecializationBody, 'tenantId'>>;

export function listServiceCategories(token: string, params: { tenantId: string; branchId?: string | null; activeOnly?: boolean }) {
  return apiFetch<unknown[]>(
    `/beauty-grooming/service-categories${toQueryString({
      tenantId: params.tenantId,
      branchId: params.branchId ?? undefined,
      activeOnly: params.activeOnly ? '1' : undefined,
    })}`,
    { token },
  );
}

export function createServiceCategory(token: string, body: CreateServiceCategoryBody) {
  return apiFetch<unknown>('/beauty-grooming/service-categories', { method: 'POST', token, json: body });
}

export function patchServiceCategory(token: string, id: string, body: PatchServiceCategoryBody) {
  return apiFetch<unknown>(`/beauty-grooming/service-categories/${encodeURIComponent(id)}`, { method: 'PATCH', token, json: body });
}

export function listServices(
  token: string,
  params: { tenantId: string; branchId?: string | null; categoryId?: string | null; activeOnly?: boolean },
) {
  return apiFetch<unknown[]>(
    `/beauty-grooming/services${toQueryString({
      tenantId: params.tenantId,
      branchId: params.branchId ?? undefined,
      categoryId: params.categoryId ?? undefined,
      activeOnly: params.activeOnly ? '1' : undefined,
    })}`,
    { token },
  );
}

export function createService(token: string, body: CreateBeautyServiceBody) {
  return apiFetch<unknown>('/beauty-grooming/services', { method: 'POST', token, json: body });
}

export function patchService(token: string, id: string, body: PatchBeautyServiceBody) {
  return apiFetch<unknown>(`/beauty-grooming/services/${encodeURIComponent(id)}`, { method: 'PATCH', token, json: body });
}

export function uploadBeautyServiceImage(
  token: string,
  params: { tenantId: string; branchId?: string | null },
  file: File,
) {
  const fd = new FormData();
  fd.append('file', file);
  return apiFetch<{ path: string; url: string }>(
    `/beauty-grooming/services/upload${toQueryString({
      tenantId: params.tenantId,
      branchId: params.branchId ?? undefined,
    })}`,
    { method: 'POST', token, body: fd },
  );
}

export function listStations(token: string, params: { tenantId: string; branchId?: string | null }) {
  return apiFetch<unknown[]>(
    `/beauty-grooming/stations${toQueryString({
      tenantId: params.tenantId,
      branchId: params.branchId ?? undefined,
    })}`,
    { token },
  );
}

export function createStation(token: string, body: CreateBeautyStationBody) {
  return apiFetch<unknown>('/beauty-grooming/stations', { method: 'POST', token, json: body });
}

export function patchStation(token: string, id: string, body: PatchBeautyStationBody) {
  return apiFetch<unknown>(`/beauty-grooming/stations/${encodeURIComponent(id)}`, { method: 'PATCH', token, json: body });
}

export function listSpecializations(token: string, params: { tenantId: string; staffId?: string | null }) {
  return apiFetch<unknown[]>(
    `/beauty-grooming/specializations${toQueryString({
      tenantId: params.tenantId,
      staffId: params.staffId ?? undefined,
    })}`,
    { token },
  );
}

export function createSpecialization(token: string, body: CreateSpecializationBody) {
  return apiFetch<unknown>('/beauty-grooming/specializations', { method: 'POST', token, json: body });
}

export function patchSpecialization(token: string, id: string, body: PatchSpecializationBody) {
  return apiFetch<unknown>(`/beauty-grooming/specializations/${encodeURIComponent(id)}`, { method: 'PATCH', token, json: body });
}

export function listAssistanceRequests(
  token: string,
  params: { tenantId: string; branchId?: string | null; status?: string | null },
) {
  return apiFetch<unknown[]>(
    `/beauty-grooming/assistance-requests${toQueryString({
      tenantId: params.tenantId,
      branchId: params.branchId ?? undefined,
      status: params.status ?? undefined,
    })}`,
    { token },
  );
}

export function patchAssistanceRequest(token: string, id: string, body: { status?: string; notes?: string | null }) {
  return apiFetch<unknown>(`/beauty-grooming/assistance-requests/${encodeURIComponent(id)}`, { method: 'PATCH', token, json: body });
}

export function listBeautyBookings(
  token: string,
  params: { tenantId: string; branchId?: string | null; status?: string | null; staffId?: string | null; date?: string | null },
) {
  return apiFetch<unknown[]>(
    `/beauty-grooming/bookings${toQueryString({
      tenantId: params.tenantId,
      branchId: params.branchId ?? undefined,
      status: params.status ?? undefined,
      staffId: params.staffId ?? undefined,
      date: params.date ?? undefined,
    })}`,
    { token },
  );
}

export function patchBeautyBooking(
  token: string,
  id: string,
  body: { status?: string; staffId?: string; scheduledAt?: string; notes?: string },
) {
  return apiFetch<unknown>(`/beauty-grooming/bookings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token,
    json: body,
  });
}
