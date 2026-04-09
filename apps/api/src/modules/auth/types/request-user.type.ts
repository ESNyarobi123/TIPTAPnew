import type { RoleCode, UserRoleAssignment } from '@prisma/client';

export type AuthUser = {
  userId: string;
  email: string;
  /** When present, caller is acting-as userId on behalf of impersonatorUserId (SUPER_ADMIN). */
  impersonatorUserId?: string;
  roleAssignments: Pick<
    UserRoleAssignment,
    'id' | 'role' | 'tenantId' | 'branchId' | 'createdAt'
  >[];
};

export function userHasRole(user: AuthUser, ...roleCodes: RoleCode[]): boolean {
  return user.roleAssignments.some((a) => roleCodes.includes(a.role));
}

export function userIsSuperAdmin(user: AuthUser): boolean {
  return userHasRole(user, 'SUPER_ADMIN');
}
