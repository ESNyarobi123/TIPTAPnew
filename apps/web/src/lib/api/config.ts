/**
 * Browser: `NEXT_PUBLIC_API_BASE_URL` (must be reachable from the user’s machine, e.g. localhost:3000).
 * Server (SSR / Route Handlers): prefer `API_INTERNAL_BASE_URL` so Docker/K8s can call the API by service name
 * (`http://api:3000/api/v1`) instead of `localhost`, which inside the web container does not reach the API.
 */
export function getApiBaseUrl(): string {
  const browserDefault = 'http://localhost:3000/api/v1';
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_BASE_URL || browserDefault;
  }
  return (
    process.env.API_INTERNAL_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    browserDefault
  );
}
