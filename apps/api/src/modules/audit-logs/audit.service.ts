import { Injectable } from '@nestjs/common';
import type { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

export type AuditWriteInput = {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  tenantId?: string;
  branchId?: string;
  actorUserId?: string;
  actorType?: string;
  correlationId?: string;
  summary?: string;
  details?: Prisma.InputJsonValue;
  changes?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async write(input: AuditWriteInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        tenantId: input.tenantId,
        branchId: input.branchId,
        actorUserId: input.actorUserId,
        actorType: input.actorType ?? 'USER',
        correlationId: input.correlationId,
        summary: input.summary,
        details: input.details,
        changes: input.changes,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }
}
