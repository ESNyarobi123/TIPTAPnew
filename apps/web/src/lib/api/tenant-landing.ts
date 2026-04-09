import { apiFetch } from './client';

export type TenantLandingDraft = {
  tenantId: string;
  slug: string;
  title?: string | null;
  subtitle?: string | null;
  heroCtaText?: string | null;
  heroCtaHref?: string | null;
  theme?: unknown;
  sections?: unknown;
  isPublished: boolean;
  publishedAt?: string | null;
  updatedAt?: string;
};

export function getTenantLanding(token: string, tenantId: string) {
  return apiFetch<TenantLandingDraft>(`/tenants/${encodeURIComponent(tenantId)}/landing`, { token });
}

export function upsertTenantLanding(token: string, tenantId: string, body: Partial<TenantLandingDraft>) {
  return apiFetch<TenantLandingDraft>(`/tenants/${encodeURIComponent(tenantId)}/landing`, {
    token,
    method: 'POST',
    json: body,
  });
}

export type TenantLandingPublicCatalog = {
  beautyServices?: {
    id: string;
    name: string;
    description: string | null;
    durationMin: number | null;
    priceCents: number | null;
    currency: string | null;
    imageUrl: string | null;
    categoryName: string;
  }[];
  menuItems?: {
    id: string;
    name: string;
    description: string | null;
    priceCents: number;
    currency: string;
    imageUrl: string | null;
    categoryName: string;
  }[];
};

export type TenantLandingPublic = {
  slug: string;
  tenantName?: string;
  tenantSlug?: string;
  title?: string | null;
  subtitle?: string | null;
  heroCtaText?: string | null;
  heroCtaHref?: string | null;
  theme?: unknown;
  sections?: unknown;
  publishedAt?: string | null;
  updatedAt?: string;
  catalog?: TenantLandingPublicCatalog;
};

export function getTenantLandingPublic(slug: string) {
  return apiFetch<TenantLandingPublic>(`/tenants/landing/${encodeURIComponent(slug)}/public`);
}

