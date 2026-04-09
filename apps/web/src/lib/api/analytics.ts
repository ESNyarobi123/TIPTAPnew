import { apiFetch } from './client';
import { toQueryString } from './query';

export type AnalyticsScopeQuery = {
  tenantId?: string;
  branchId?: string;
  startDate?: string;
  endDate?: string;
  groupBy?: string;
};

export function analyticsOverview(token: string, q: AnalyticsScopeQuery) {
  return apiFetch<unknown>(`/analytics/overview${toQueryString(q)}`, { token });
}

export function analyticsPayments(
  token: string,
  q: AnalyticsScopeQuery & { type?: string; status?: string },
) {
  return apiFetch<unknown>(`/analytics/payments${toQueryString(q)}`, { token });
}

export function analyticsTips(token: string, q: AnalyticsScopeQuery & { staffId?: string }) {
  return apiFetch<unknown>(`/analytics/tips${toQueryString(q)}`, { token });
}

export function analyticsRatings(
  token: string,
  q: AnalyticsScopeQuery & { lowScoreMax?: number },
) {
  return apiFetch<unknown>(`/analytics/ratings${toQueryString(q)}`, { token });
}

export function analyticsOperations(token: string, q: AnalyticsScopeQuery) {
  return apiFetch<unknown>(`/analytics/operations${toQueryString(q)}`, { token });
}

export function analyticsFoodDining(token: string, q: AnalyticsScopeQuery) {
  return apiFetch<unknown>(`/analytics/food-dining${toQueryString(q)}`, { token });
}

export function analyticsBeautyGrooming(token: string, q: AnalyticsScopeQuery) {
  return apiFetch<unknown>(`/analytics/beauty-grooming${toQueryString(q)}`, { token });
}
