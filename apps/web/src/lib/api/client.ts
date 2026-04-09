import { getApiBaseUrl } from './config';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type RequestOptions = RequestInit & {
  token?: string | null;
  json?: unknown;
};

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { token, json, headers: hdrs, ...rest } = opts;
  const base = getApiBaseUrl().replace(/\/$/, '');
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(hdrs);
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch (err) {
    const isOffline =
      err instanceof TypeError &&
      (err.message === 'Failed to fetch' || err.message.includes('fetch'));
    throw new ApiError(
      isOffline
        ? 'Server unreachable — start the API on port 3000 and ensure PostgreSQL is running (see infra/docker).'
        : err instanceof Error
          ? err.message
          : 'Network error',
      0,
    );
  }

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg =
      typeof data === 'object' && data && 'message' in data
        ? String((data as { message: unknown }).message)
        : res.statusText;
    const normalized = (msg || '').toLowerCase();
    const isRoleDenied =
      res.status === 403 &&
      (normalized.includes('insufficient role') ||
        normalized.includes('forbidden') ||
        normalized.includes('no access'));
    const friendly =
      isRoleDenied
        ? 'Your account is ready, but access to this workspace has not been granted yet. If you just signed up, wait a moment and refresh — or contact an administrator.'
        : msg || 'Request failed';
    throw new ApiError(friendly, res.status, data);
  }

  return data as T;
}
