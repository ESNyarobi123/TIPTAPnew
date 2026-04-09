import { apiFetch } from './client';

export type LoginBody = { email: string; password: string };
export type RegisterBody = { email: string; password: string; firstName?: string; lastName?: string };

export type AuthResponse = {
  accessToken: string;
  refreshToken?: string;
  user?: { id: string; email: string };
};

export async function login(body: LoginBody): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', { method: 'POST', json: body });
}

export async function register(body: RegisterBody): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/register', { method: 'POST', json: body });
}

export type MeResponse = {
  id: string;
  email: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  isActive: boolean;
  roles: { role: string; tenantId?: string | null; branchId?: string | null }[];
  impersonation?: { by: { id: string; email: string; name: string } } | null;
};

export async function me(token: string): Promise<MeResponse> {
  return apiFetch<MeResponse>('/auth/me', { token });
}
