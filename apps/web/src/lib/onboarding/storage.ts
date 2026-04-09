export type BusinessCategory = 'FOOD_DINING' | 'BEAUTY_GROOMING';

export type BusinessSubtype =
  | 'RESTAURANT'
  | 'CAFE'
  | 'SEAFOOD'
  | 'LOUNGE'
  | 'DINING_BRAND'
  | 'SALON'
  | 'BARBER_SHOP'
  | 'SPA'
  | 'BEAUTY_STUDIO';

export type BusinessOnboardingDraft = {
  account?: { firstName?: string; lastName?: string; email?: string };
  business?: { name?: string; brandName?: string; phone?: string; businessEmail?: string; country?: string; city?: string; address?: string };
  category?: BusinessCategory;
  subtype?: BusinessSubtype;
  branch?: { name?: string; code?: string; address?: string; city?: string; country?: string; phone?: string; email?: string; timezone?: string };
};

export type ProviderOnboardingDraft = {
  account?: { firstName?: string; lastName?: string; email?: string };
  type?: 'STAFF' | 'PROVIDER';
  profile?: { displayName?: string; phone?: string; skills?: string };
  join?: { joinCode?: string; connectLater?: boolean };
};

const K_BIZ = 'tiptap_onboarding_business_v1';
const K_PRO = 'tiptap_onboarding_provider_v1';

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadBusinessDraft(): BusinessOnboardingDraft {
  if (typeof window === 'undefined') return {};
  return safeParse<BusinessOnboardingDraft>(window.sessionStorage.getItem(K_BIZ)) ?? {};
}

export function saveBusinessDraft(next: BusinessOnboardingDraft) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(K_BIZ, JSON.stringify(next));
}

export function clearBusinessDraft() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(K_BIZ);
}

export function loadProviderDraft(): ProviderOnboardingDraft {
  if (typeof window === 'undefined') return {};
  return safeParse<ProviderOnboardingDraft>(window.sessionStorage.getItem(K_PRO)) ?? {};
}

export function saveProviderDraft(next: ProviderOnboardingDraft) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(K_PRO, JSON.stringify(next));
}

export function clearProviderDraft() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(K_PRO);
}

