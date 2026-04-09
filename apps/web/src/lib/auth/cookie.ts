const COOKIE = 'tiptap_access_token';
const MAX_AGE_SEC = 60 * 60 * 24 * 7;

/** Mirrors token into a cookie so Next.js middleware can guard /dashboard routes. */
export function syncAuthCookie(token: string | null): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (!token) {
    document.cookie = `${COOKIE}=; path=/; max-age=0; SameSite=Lax`;
    return;
  }
  const enc = encodeURIComponent(token);
  document.cookie = `${COOKIE}=${enc}; path=/; max-age=${MAX_AGE_SEC}; SameSite=Lax`;
}

export const AUTH_COOKIE_NAME = COOKIE;
