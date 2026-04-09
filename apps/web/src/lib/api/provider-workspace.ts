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
    payoutProfile?: {
      method?: string | null;
      recipientLabel?: string | null;
      accountMask?: string | null;
      note?: string | null;
    } | null;
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
  desk: {
    openRequestCount: number;
    activeTaskCount: number;
    requestQueue: {
      id: string;
      kind: 'WAITER_CALL' | 'ASSISTANCE_REQUEST';
      vertical: 'FOOD_DINING' | 'BEAUTY_GROOMING';
      tenantId: string;
      tenantName: string;
      branchId: string;
      branchName: string;
      status: string;
      locationLabel?: string | null;
      notes?: string | null;
      createdAt: string;
    }[];
    taskQueue: {
      id: string;
      kind: 'DINING_ORDER' | 'BEAUTY_BOOKING';
      vertical: 'FOOD_DINING' | 'BEAUTY_GROOMING';
      tenantId: string;
      tenantName: string;
      branchId: string;
      branchName: string;
      status: string;
      reference: string;
      customerLabel?: string | null;
      locationLabel?: string | null;
      amountCents?: number | null;
      currency?: string | null;
      scheduledAt?: string | null;
      serviceSummary?: string[] | null;
      createdAt: string;
    }[];
  };
};

export function getProviderWorkspace(token: string) {
  return apiFetch<ProviderWorkspace>('/staff/me/workspace', { token });
}
