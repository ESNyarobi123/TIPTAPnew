'use client';

import { getStoredToken, setStoredToken } from './storage';

const SK_BEFORE = 'tiptap_token_before_impersonation';

export function stashTokenBeforeImpersonation(): void {
  const t = getStoredToken();
  if (!t) return;
  localStorage.setItem(SK_BEFORE, t);
}

export function hasStashedToken(): boolean {
  return Boolean(localStorage.getItem(SK_BEFORE));
}

export function restoreTokenAfterImpersonation(): boolean {
  const raw = localStorage.getItem(SK_BEFORE);
  if (!raw) {
    return false;
  }
  localStorage.removeItem(SK_BEFORE);
  setStoredToken(raw);
  return true;
}

export function clearStashedToken(): void {
  localStorage.removeItem(SK_BEFORE);
}

