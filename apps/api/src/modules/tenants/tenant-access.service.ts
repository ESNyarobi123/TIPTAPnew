import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { AuthUser } from '../auth/types/request-user.type';
import { userIsSuperAdmin } from '../auth/types/request-user.type';

@Injectable()
export class TenantAccessService {
  constructor(private readonly prisma: PrismaService) {}

  getOwnerTenantIds(user: AuthUser): string[] {
    return user.roleAssignments
      .filter((a) => a.role === 'TENANT_OWNER' && a.tenantId)
      .map((a) => a.tenantId as string);
  }

  getManagedBranchIds(user: AuthUser): string[] {
    return user.roleAssignments
      .filter((a) => a.role === 'BRANCH_MANAGER' && a.branchId)
      .map((a) => a.branchId as string);
  }

  private static readonly staffScopedRoles = new Set<RoleCode>([
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  ]);

  /** Branches where the user works as cashier / service staff / support (scoped assignments). */
  getStaffBranchIds(user: AuthUser): string[] {
    return user.roleAssignments
      .filter((a) => TenantAccessService.staffScopedRoles.has(a.role) && a.branchId)
      .map((a) => a.branchId as string);
  }

  /** Tenant IDs from staff role assignments (waiters, front desk, etc.). */
  getStaffTenantIds(user: AuthUser): string[] {
    return [
      ...new Set(
        user.roleAssignments
          .filter((a) => TenantAccessService.staffScopedRoles.has(a.role) && a.tenantId)
          .map((a) => a.tenantId as string),
      ),
    ];
  }

  /** Branch IDs the user may read (managers + staff at a branch). */
  getReadableBranchIds(user: AuthUser): string[] {
    return [...new Set([...this.getManagedBranchIds(user), ...this.getStaffBranchIds(user)])];
  }

  assertRoleAssignmentShape(
    role: RoleCode,
    tenantId: string | null | undefined,
    branchId: string | null | undefined,
  ): void {
    if (role === 'SUPER_ADMIN') {
      if (tenantId != null || branchId != null) {
        throw new BadRequestException('SUPER_ADMIN assignment must not set tenant or branch');
      }
      return;
    }
    if (role === 'TENANT_OWNER') {
      if (!tenantId || branchId != null) {
        throw new BadRequestException('TENANT_OWNER requires tenantId and no branchId');
      }
      return;
    }
    if (role === 'BRANCH_MANAGER') {
      if (!tenantId || !branchId) {
        throw new BadRequestException('BRANCH_MANAGER requires tenantId and branchId');
      }
      return;
    }
    if (
      role === 'CASHIER' ||
      role === 'SERVICE_STAFF' ||
      role === 'SUPPORT_AGENT'
    ) {
      if (!tenantId || !branchId) {
        throw new BadRequestException(
          `${role} requires tenantId and branchId for scoped operations`,
        );
      }
    }
  }

  async assertBranchBelongsToTenant(branchId: string, tenantId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId, deletedAt: null },
    });
    if (!branch) {
      throw new BadRequestException('Branch does not belong to the given tenant');
    }
  }

  async assertReadableTenant(user: AuthUser, tenantId: string): Promise<void> {
    if (userIsSuperAdmin(user)) {
      return;
    }
    if (this.getOwnerTenantIds(user).includes(tenantId)) {
      return;
    }
    if (this.getStaffTenantIds(user).includes(tenantId)) {
      return;
    }
    const readableBranches = this.getReadableBranchIds(user);
    if (readableBranches.length === 0) {
      throw new ForbiddenException('No access to this tenant');
    }
    const hit = await this.prisma.branch.findFirst({
      where: {
        id: { in: readableBranches },
        tenantId,
        deletedAt: null,
      },
    });
    if (!hit) {
      throw new ForbiddenException('No access to this tenant');
    }
  }

  async assertWritableTenant(user: AuthUser, tenantId: string): Promise<void> {
    if (userIsSuperAdmin(user)) {
      return;
    }
    if (this.getOwnerTenantIds(user).includes(tenantId)) {
      return;
    }
    throw new ForbiddenException('Cannot modify this tenant');
  }

  async assertReadableBranch(user: AuthUser, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, deletedAt: null },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    if (userIsSuperAdmin(user)) {
      return;
    }
    if (this.getOwnerTenantIds(user).includes(branch.tenantId)) {
      return;
    }
    const readable = this.getReadableBranchIds(user);
    if (readable.includes(branchId)) {
      return;
    }
    throw new ForbiddenException('No access to this branch');
  }

  async assertWritableBranch(user: AuthUser, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, deletedAt: null },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    if (userIsSuperAdmin(user)) {
      return;
    }
    if (this.getOwnerTenantIds(user).includes(branch.tenantId)) {
      return;
    }
    const managed = this.getManagedBranchIds(user);
    if (managed.includes(branchId)) {
      return;
    }
    throw new ForbiddenException('Cannot modify this branch');
  }
}
