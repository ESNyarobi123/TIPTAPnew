import { apiFetch } from './client';

export type ProviderProfilePublic = {
  id: string;
  registryCode?: string | null;
  displayName: string;
  headline?: string | null;
  bio?: string | null;
  verifiedSummary?: string | null;
  publicRatingAvg?: number | null;
  publicRatingCount?: number;
  skills?: string[];
};

export type ProviderProfileInternal = ProviderProfilePublic & {
  publicSlug?: string | null;
  internalNotes?: string | null;
  payoutProfile?: {
    method?: string | null;
    recipientLabel?: string | null;
    accountMask?: string | null;
    note?: string | null;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ProviderProfileLookup = {
  id: string;
  userId?: string | null;
  registryCode?: string | null;
  publicSlug?: string | null;
  displayName: string;
  headline?: string | null;
  verifiedSummary?: string | null;
  publicRatingAvg?: number | null;
  publicRatingCount?: number;
  skills?: string[];
  employmentSummary?: {
    linkedBusinesses: number;
    activeAssignments: number;
    completedAssignments: number;
    averageRating?: number | null;
    totalRatings: number;
  };
  employmentHistory?: {
    staffId: string;
    tenantId: string;
    tenantName?: string | null;
    branchId?: string | null;
    branchName?: string | null;
    roleInTenant: string;
    status: string;
    categories: string[];
    activeAssignmentCount: number;
    lastAssignmentMode?: string | null;
    lastWorkedAt: string;
  }[];
};

export function getProviderProfilePublic(profileId: string) {
  return apiFetch<ProviderProfilePublic>(`/provider-registry/${encodeURIComponent(profileId)}/public`);
}

export function getMyProviderProfile(token: string) {
  return apiFetch<ProviderProfileInternal>(`/provider-registry/self`, { token });
}

export function upsertMyProviderProfile(
  token: string,
  body: {
    displayName?: string;
    headline?: string | null;
    bio?: string | null;
    publicSlug?: string | null;
    skills?: string[];
    payoutMethod?: string | null;
    payoutRecipientLabel?: string | null;
    payoutAccountMask?: string | null;
    payoutNote?: string | null;
  },
) {
  return apiFetch<ProviderProfileInternal>(`/provider-registry/self`, {
    token,
    method: 'POST',
    json: body,
  });
}

export function lookupProviderProfile(token: string, code: string) {
  return apiFetch<ProviderProfileLookup>(`/provider-registry/lookup/${encodeURIComponent(code)}`, { token });
}

export function getProviderProfileInternal(token: string, profileId: string) {
  return apiFetch<ProviderProfileInternal>(`/provider-registry/${encodeURIComponent(profileId)}`, { token });
}

export function updateProviderProfileInternal(
  token: string,
  profileId: string,
  body: {
    internalNotes?: string | null;
    verifiedSummary?: string | null;
    headline?: string | null;
    bio?: string | null;
    skills?: string[];
    payoutMethod?: string | null;
    payoutRecipientLabel?: string | null;
    payoutAccountMask?: string | null;
    payoutNote?: string | null;
  },
) {
  return apiFetch<ProviderProfileInternal>(`/provider-registry/${encodeURIComponent(profileId)}`, {
    token,
    method: 'PATCH',
    json: body,
  });
}
