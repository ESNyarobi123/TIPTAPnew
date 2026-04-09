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
export class BeautyGroomingAccessService {
  constructor(
    private readonly access: TenantAccessService,
    private readonly prisma: PrismaService,
  ) {}

  private async assertBeautyEnabled(tenantId: string): Promise<void> {
    const enabled = await this.prisma.tenantCategory.findFirst({
      where: {
        tenantId,
        category: 'BEAUTY_GROOMING',
        enabled: true,
      },
      select: { id: true },
    });
    if (!enabled) {
      throw new ForbiddenException('Beauty & Grooming is not enabled for this tenant');
    }
  }

  async assertReadableTenantBeauty(actor: AuthUser, tenantId: string): Promise<void> {
    await this.access.assertReadableTenant(actor, tenantId);
    await this.assertBeautyEnabled(tenantId);
  }

  async assertCanManageCatalogRow(
    actor: AuthUser,
    tenantId: string,
    branchId: string | null,
  ): Promise<void> {
    await this.access.assertWritableTenant(actor, tenantId);
    await this.assertBeautyEnabled(tenantId);
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
      throw new ForbiddenException('Only tenant owner can manage tenant-wide catalog rows');
    }
    throw new ForbiddenException('Cannot manage catalog for this branch');
  }

  async assertCanManageBranchRow(actor: AuthUser, tenantId: string, branchId: string): Promise<void> {
    await this.access.assertWritableTenant(actor, tenantId);
    await this.assertBeautyEnabled(tenantId);
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

  async assertCanOperateBranchBookings(actor: AuthUser, tenantId: string, branchId: string): Promise<void> {
    await this.assertReadableTenantBeauty(actor, tenantId);
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
    throw new ForbiddenException('Cannot operate beauty bookings for this branch');
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
