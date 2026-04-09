import { apiFetch } from './client';

export type ProviderWorkspaceLink = {
  staffId: string;
  displayName: string;
  roleInTenant: string;
  status: string;
  publicHandle?: string | null;
  tenantId: string;
  tenantName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  categories: string[];
  activeAssignments: {
    id: string;
    branchId: string;
    branchName?: string | null;
    status: string;
    mode: string;
    startedAt: string;
    endedAt?: string | null;
  }[];
  /** Past branch assignments (ended or closed). */
  assignmentHistory: {
    id: string;
    branchId: string;
    branchName?: string | null;
    status: string;
    mode: string;
    startedAt: string;
    endedAt?: string | null;
  }[];
  tipSummary: {
    totalCents: number;
    completedCents: number;
    totalCount: number;
    pendingCount: number;
  };
  ratingSummary: {
    averageScore?: number | null;
    totalCount: number;
  };
  compensationSummary: {
    totalCents: number;
    paidCents: number;
    scheduledCents: number;
    totalCount: number;
  };
};

export type ProviderWorkspace = {
  providerProfile?: {
    id: string;
    registryCode?: string | null;
    displayName: string;
    headline?: string | null;
    bio?: string | null;
    verifiedSummary?: string | null;
    publicRatingAvg?: number | null;
    publicRatingCount?: number;
    skills?: string[];
    publicSlug?: string | null;
    internalNotes?: string | null;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  summary: {
    linkedBusinesses: number;
    activeAssignments: number;
    totalTipsCents: number;
    totalTipsCount: number;
    totalCompensationCents: number;
    paidCompensationCents: number;
    scheduledCompensationCents: number;
    compensationCount: number;
    ratingAverage?: number | null;
    ratingCount: number;
    categories: string[];
  };
  links: ProviderWorkspaceLink[];
  recentTips: {
    id: string;
    staffId: string;
    staffName: string;
    branchId?: string | null;
    branchName?: string | null;
    mode: string;
    status: string;
    amountCents: number;
    currency: string;
    createdAt: string;
  }[];
  recentRatings: {
    id: string;
    staffId?: string | null;
    staffName?: string | null;
    branchId?: string | null;
    branchName?: string | null;
    vertical?: string | null;
    targetType: string;
    score: number;
    maxScore: number;
    comment?: string | null;
    createdAt: string;
  }[];
  recentCompensations: {
    id: string;
    staffId: string;
    staffName: string;
    branchId?: string | null;
    branchName?: string | null;
    type: string;
    status: string;
    amountCents: number;
    currency: string;
    periodLabel?: string | null;
    effectiveDate: string;
    paidAt?: string | null;
    createdAt: string;
  }[];
};

export function getProviderWorkspace(token: string) {
  return apiFetch<ProviderWorkspace>('/staff/me/workspace', { token });
}
