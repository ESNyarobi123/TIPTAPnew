export function toQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') {
      continue;
    }
    sp.set(k, String(v));
  }
  const q = sp.toString();
  return q ? `?${q}` : '';
}
