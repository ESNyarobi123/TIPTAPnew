import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditService } from '../../audit-logs/audit.service';
import { TenantAccessService } from '../../tenants/tenant-access.service';
import type { FoodDiningRequestMeta } from '../menu-categories/menu-categories.service';

@Injectable()
export class DiningSupportRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
    private readonly audit: AuditService,
  ) {}

  async createFromSession(
    params: {
      tenantId: string;
      branchId: string;
      sessionId: string;
      subject?: string;
      details?: string;
    },
    meta: FoodDiningRequestMeta,
  ) {
    await this.access.assertBranchBelongsToTenant(params.branchId, params.tenantId);

    const row = await this.prisma.diningCustomerServiceRequest.create({
      data: {
        tenantId: params.tenantId,
        branchId: params.branchId,
        sessionId: params.sessionId,
        subject: params.subject?.trim() ?? 'Customer support (conversation)',
        details: params.details?.trim(),
        status: 'OPEN',
      },
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'DiningCustomerServiceRequest',
      entityId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      actorType: 'CONVERSATION_SESSION',
      correlationId: meta.correlationId,
      summary: 'Dining support request from customer session',
      details: { sessionId: params.sessionId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return row;
  }
}
