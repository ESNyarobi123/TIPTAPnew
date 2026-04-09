import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { AuthUser } from '../auth/types/request-user.type';
import { userIsSuperAdmin } from '../auth/types/request-user.type';
import { TenantAccessService } from '../tenants/tenant-access.service';

@Injectable()
export class FoodDiningAccessService {
  constructor(
    private readonly access: TenantAccessService,
    private readonly prisma: PrismaService,
  ) {}

  private async assertFoodEnabled(tenantId: string): Promise<void> {
    const enabled = await this.prisma.tenantCategory.findFirst({
      where: {
        tenantId,
        category: 'FOOD_DINING',
        enabled: true,
      },
      select: { id: true },
    });
    if (!enabled) {
      throw new ForbiddenException('Food & Dining is not enabled for this tenant');
    }
  }

  /** List / read: tenant-wide + branch rows user can see. */
  async assertReadableTenantFood(actor: AuthUser, tenantId: string): Promise<void> {
    await this.access.assertReadableTenant(actor, tenantId);
    await this.assertFoodEnabled(tenantId);
  }

  /**
   * Tenant-wide menu row (branchId null): owner or super only.
   * Branch-scoped row: owner, super, or branch manager of that branch.
   */
  async assertCanManageMenuRow(
    actor: AuthUser,
    tenantId: string,
    branchId: string | null,
  ): Promise<void> {
    await this.access.assertWritableTenant(actor, tenantId);
    await this.assertFoodEnabled(tenantId);
    if (userIsSuperAdmin(actor)) {
      return;
    }
    if (this.access.getOwnerTenantIds(actor).includes(tenantId)) {
      return;
    }
    if (branchId && this.access.getManagedBranchIds(actor).includes(branchId)) {
      return;
    }
    if (!branchId) {
      throw new ForbiddenException('Only tenant owner can manage tenant-wide menu rows');
    }
    throw new ForbiddenException('Cannot manage menu for this branch');
  }

  /** Tables, waiter calls, bill requests: always branch-scoped. */
  async assertCanManageBranchRow(actor: AuthUser, tenantId: string, branchId: string): Promise<void> {
    await this.access.assertWritableTenant(actor, tenantId);
    await this.assertFoodEnabled(tenantId);
    if (userIsSuperAdmin(actor)) {
      return;
    }
    if (this.access.getOwnerTenantIds(actor).includes(tenantId)) {
      return;
    }
    if (this.access.getManagedBranchIds(actor).includes(branchId)) {
      return;
    }
    throw new ForbiddenException('Cannot manage resources for this branch');
  }

  /**
   * Orders: floor staff (service/cashier/support) may create/update within their branch;
   * managers and owners retain broader write access via branch management or tenant ownership.
   */
  async assertCanOperateBranchOrders(actor: AuthUser, tenantId: string, branchId: string): Promise<void> {
    await this.assertReadableTenantFood(actor, tenantId);
    if (userIsSuperAdmin(actor)) {
      return;
    }
    if (this.access.getOwnerTenantIds(actor).includes(tenantId)) {
      return;
    }
    if (this.access.getManagedBranchIds(actor).includes(branchId)) {
      return;
    }
    const floor = actor.roleAssignments.some(
      (a) =>
        a.tenantId === tenantId &&
        a.branchId === branchId &&
        (a.role === 'CASHIER' || a.role === 'SERVICE_STAFF' || a.role === 'SUPPORT_AGENT'),
    );
    if (floor) {
      return;
    }
    throw new ForbiddenException('Cannot operate dining orders for this branch');
  }

  async resolveTenantId(actor: AuthUser, queryTenantId?: string): Promise<string> {
    const q = queryTenantId?.trim();
    if (userIsSuperAdmin(actor)) {
      if (!q) {
        throw new BadRequestException('tenantId query parameter is required');
      }
      return q;
    }
    if (q) {
      await this.access.assertReadableTenant(actor, q);
      return q;
    }
    const owned = this.access.getOwnerTenantIds(actor);
    if (owned.length === 1) {
      return owned[0]!;
    }
    throw new BadRequestException('tenantId query parameter is required');
  }
}
