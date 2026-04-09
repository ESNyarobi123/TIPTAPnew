'use client';

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { me } from '@/lib/api/auth';
import { getProviderWorkspace } from '@/lib/api/provider-workspace';
import type { MeResponse } from '@/lib/api/auth';
import { pickPrimaryWorkspace } from '@/components/workspace/role';

export function workspacePathFromProfile(profile: Pick<MeResponse, 'roles'>): string {
  const ws = pickPrimaryWorkspace(profile.roles);
  if (ws === 'admin') return '/admin';
  if (ws === 'provider') return '/provider';
  if (ws === 'dashboard') return '/dashboard';
  return '/access-pending';
}

export async function resolveWorkspacePathFromToken(token: string): Promise<string> {
  const profile = await me(token);
  const primary = workspacePathFromProfile(profile);
  if (primary !== '/access-pending') {
    return primary;
  }
  try {
    const workspace = await getProviderWorkspace(token);
    if (workspace.providerProfile || workspace.links.length > 0) {
      return '/provider';
    }
    return '/access-pending';
  } catch {
    return '/access-pending';
  }
}

export async function replaceToWorkspaceFromToken(router: AppRouterInstance, token: string) {
  const dest = await resolveWorkspacePathFromToken(token);
  router.replace(dest);
  router.refresh();
}
