import { syncAuthCookie } from './cookie';

const KEY = 'tiptap_access_token';
const USER_KEY = 'tiptap_user_preview';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (token) {
    localStorage.setItem(KEY, token);
  } else {
    localStorage.removeItem(KEY);
  }
  syncAuthCookie(token);
}

export type StoredUserPreview = {
  email?: string;
  userId?: string;
};

export function setUserPreview(u: StoredUserPreview | null) {
  if (typeof window === 'undefined') {
    return;
  }
  if (u) {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

export function getUserPreview(): StoredUserPreview | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as StoredUserPreview;
  } catch {
    return null;
  }
}
