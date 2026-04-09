import { getApiBaseUrl } from './config';

/** Turn stored API path (`/files/...`) into a browser-loadable URL. */
export function apiMediaUrl(path: string | null | undefined): string | undefined {
  if (!path || typeof path !== 'string') return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (!path.startsWith('/files/')) return undefined;
  const base = getApiBaseUrl().replace(/\/$/, '');
  return `${base}${path}`;
}
