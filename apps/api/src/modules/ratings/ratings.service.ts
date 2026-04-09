import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BusinessCategory, Prisma, RatingTargetType } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit-logs/audit.service';
import type { AuthUser } from '../auth/types/request-user.type';
import { userIsSuperAdmin } from '../auth/types/request-user.type';
import { TenantAccessService } from '../tenants/tenant-access.service';
import { parseRatingPolicy, type ResolvedRatingPolicy } from './rating-policy';
import type { CreateRatingDto } from './dto/create-rating.dto';
import type { PatchRatingDto } from './dto/patch-rating.dto';

export type RatingsRequestMeta = {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class RatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
    private readonly audit: AuditService,
  ) {}

  private async loadVerticalPolicy(tenantId: string, vertical: BusinessCategory): Promise<ResolvedRatingPolicy> {
    const row = await this.prisma.tenantCategory.findUnique({
      where: { tenantId_category: { tenantId, category: vertical } },
    });
    return parseRatingPolicy(row?.settings, vertical);
  }

  /** Used by conversation engines (no authenticated user). */
  getPolicyForVertical(tenantId: string, vertical: BusinessCategory): Promise<ResolvedRatingPolicy> {
    return this.loadVerticalPolicy(tenantId, vertical);
  }

  private async assertTargetValid(
    tenantId: string,
    branchId: string | null,
    targetType: RatingTargetType,
    targetId: string,
  ) {
    switch (targetType) {
      case 'BUSINESS':
        if (targetId !== tenantId) {
          throw new BadRequestException('BUSINESS rating targetId must be the tenant id');
        }
        return;
      case 'STAFF':
      case 'PROVIDER_EXPERIENCE': {
        const st = await this.prisma.staff.findFirst({
          where: { id: targetId, tenantId, deletedAt: null },
        });
        if (!st) {
          throw new BadRequestException('Staff target not found for tenant');
        }
        if (branchId && st.branchId && st.branchId !== branchId) {
          throw new BadRequestException('Staff is not associated with this branch');
        }
        return;
      }
      case 'SERVICE': {
        const beauty = await this.prisma.beautyService.findFirst({
          where: { id: targetId, tenantId, deletedAt: null },
        });
        if (beauty) {
          return;
        }
        const food = await this.prisma.diningMenuItem.findFirst({
          where: { id: targetId, tenantId, deletedAt: null },
        });
        if (food) {
          return;
        }
        throw new BadRequestException('SERVICE target must be a beauty service or menu item in this tenant');
      }
      default:
        throw new BadRequestException('Unsupported target type');
    }
  }

  private staffIdForTarget(targetType: RatingTargetType, targetId: string): string | null {
    if (targetType === 'STAFF' || targetType === 'PROVIDER_EXPERIENCE') {
      return targetId;
    }
    return null;
  }

  private assertCanManageRating(actor: AuthUser, tenantId: string, sessionBranchId: string | null) {
    if (userIsSuperAdmin(actor)) {
      return;
    }
    if (this.access.getOwnerTenantIds(actor).includes(tenantId)) {
      return;
    }
    if (sessionBranchId && this.access.getManagedBranchIds(actor).includes(sessionBranchId)) {
      return;
    }
    throw new ForbiddenException('Cannot manage ratings for this scope');
  }

  async create(actor: AuthUser, dto: CreateRatingDto, meta: RatingsRequestMeta) {
    await this.access.assertReadableTenant(actor, dto.tenantId);

    const session = await this.prisma.conversationSession.findFirst({
      where: { id: dto.sessionId, tenantId: dto.tenantId, deletedAt: null },
    });
    if (!session) {
      throw new BadRequestException('Session not found for tenant');
    }
    this.assertCanManageRating(actor, dto.tenantId, session.branchId);

    const metaJson = session.metadata as Record<string, unknown> | null;
    const vertical =
      metaJson?.primaryCategory === 'BEAUTY_GROOMING' ? 'BEAUTY_GROOMING' : 'FOOD_DINING';

    const policy = await this.loadVerticalPolicy(dto.tenantId, vertical);
    if (!policy.allowedTargets.includes(dto.targetType)) {
      throw new BadRequestException('Target type not allowed by tenant policy');
    }
    const maxScore = policy.maxScore;
    const minScore = policy.minScore;
    if (dto.score < minScore || dto.score > maxScore) {
      throw new BadRequestException(`Score must be between ${minScore} and ${maxScore}`);
    }
    if (policy.commentRequired && !(dto.comment?.trim())) {
      throw new BadRequestException('Comment is required');
    }

    const branchId = dto.branchId?.trim() || session.branchId;
    await this.assertTargetValid(dto.tenantId, branchId ?? null, dto.targetType, dto.targetId);

    return this.upsertSessionRating(
      {
        tenantId: dto.tenantId,
        branchId: branchId ?? null,
        sessionId: dto.sessionId,
        vertical,
        targetType: dto.targetType,
        targetId: dto.targetId,
        score: dto.score,
        maxScore,
        comment: dto.comment?.trim() ?? null,
        staffId: this.staffIdForTarget(dto.targetType, dto.targetId),
        policy,
      },
      { actorUserId: actor.userId, ...meta },
    );
  }

  async createFromConversation(
    params: {
      tenantId: string;
      branchId: string | null;
      sessionId: string;
      vertical: BusinessCategory;
      targetType: RatingTargetType;
      targetId: string;
      score: number;
      comment?: string | null;
    },
    meta: RatingsRequestMeta,
  ) {
    const policy = await this.loadVerticalPolicy(params.tenantId, params.vertical);
    if (!policy.allowedTargets.includes(params.targetType)) {
      throw new BadRequestException('Target type not allowed');
    }
    const maxScore = policy.maxScore;
    const minScore = policy.minScore;
    if (params.score < minScore || params.score > maxScore) {
      throw new BadRequestException(`Score must be between ${minScore} and ${maxScore}`);
    }
    if (policy.commentRequired && !(params.comment?.trim())) {
      throw new BadRequestException('Comment is required');
    }

    await this.assertTargetValid(params.tenantId, params.branchId, params.targetType, params.targetId);

    return this.upsertSessionRating(
      {
        tenantId: params.tenantId,
        branchId: params.branchId,
        sessionId: params.sessionId,
        vertical: params.vertical,
        targetType: params.targetType,
        targetId: params.targetId,
        score: params.score,
        maxScore,
        comment: params.comment?.trim() ?? null,
        staffId: this.staffIdForTarget(params.targetType, params.targetId),
        policy,
      },
      { actorType: 'CONVERSATION_SESSION', ...meta },
    );
  }

  private async upsertSessionRating(
    input: {
      tenantId: string;
      branchId: string | null;
      sessionId: string;
      vertical: BusinessCategory;
      targetType: RatingTargetType;
      targetId: string;
      score: number;
      maxScore: number;
      comment: string | null;
      staffId: string | null;
      policy: ResolvedRatingPolicy;
    },
    audit: { actorUserId?: string; actorType?: string } & RatingsRequestMeta,
  ) {
    const existing = await this.prisma.rating.findFirst({
      where: {
        sessionId: input.sessionId,
        targetType: input.targetType,
        targetId: input.targetId,
        deletedAt: null,
      },
    });

    if (existing) {
      const windowMs = input.policy.updateWindowMinutes * 60_000;
      if (Date.now() - existing.createdAt.getTime() > windowMs) {
        throw new ConflictException('A rating already exists for this session and target');
      }
      const updated = await this.prisma.rating.update({
        where: { id: existing.id },
        data: {
          score: input.score,
          maxScore: input.maxScore,
          comment: input.comment,
          vertical: input.vertical,
          branchId: input.branchId,
          staffId: input.staffId,
        },
      });
      await this.audit.write({
        action: 'UPDATE',
        entityType: 'Rating',
        entityId: updated.id,
        tenantId: updated.tenantId,
        branchId: updated.branchId ?? undefined,
        actorUserId: audit.actorUserId,
        actorType: audit.actorType ?? 'USER',
        correlationId: audit.correlationId,
        summary: 'Rating updated (session window)',
        changes: { score: input.score } as unknown as Prisma.InputJsonValue,
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      });
      return updated;
    }

    const row = await this.prisma.rating.create({
      data: {
        tenantId: input.tenantId,
        branchId: input.branchId,
        vertical: input.vertical,
        targetType: input.targetType,
        targetId: input.targetId,
        staffId: input.staffId,
        sessionId: input.sessionId,
        score: input.score,
        maxScore: input.maxScore,
        comment: input.comment,
      },
    });

    await this.audit.write({
      action: 'CREATE',
      entityType: 'Rating',
      entityId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId ?? undefined,
      actorUserId: audit.actorUserId,
      actorType: audit.actorType ?? 'USER',
      correlationId: audit.correlationId,
      summary: 'Rating created',
      details: { targetType: row.targetType, sessionId: row.sessionId } as Prisma.InputJsonValue,
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    });

    return row;
  }

  async findAll(
    actor: AuthUser,
    tenantId: string,
    opts: { sessionId?: string; targetType?: RatingTargetType },
  ) {
    await this.access.assertReadableTenant(actor, tenantId);
    return this.prisma.rating.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(opts.sessionId ? { sessionId: opts.sessionId } : {}),
        ...(opts.targetType ? { targetType: opts.targetType } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const row = await this.prisma.rating.findFirst({ where: { id, deletedAt: null } });
    if (!row) {
      throw new NotFoundException('Rating not found');
    }
    await this.access.assertReadableTenant(actor, row.tenantId);
    return row;
  }

  async patch(actor: AuthUser, id: string, dto: PatchRatingDto, meta: RatingsRequestMeta) {
    const row = await this.prisma.rating.findFirst({ where: { id, deletedAt: null } });
    if (!row) {
      throw new NotFoundException('Rating not found');
    }
    await this.access.assertReadableTenant(actor, row.tenantId);
    this.assertCanManageRating(actor, row.tenantId, row.branchId);

    const vertical = row.vertical ?? 'FOOD_DINING';
    const policy = await this.loadVerticalPolicy(row.tenantId, vertical);
    const windowMs = policy.updateWindowMinutes * 60_000;
    if (Date.now() - row.createdAt.getTime() > windowMs) {
      throw new BadRequestException('Rating can no longer be edited');
    }

    const maxScore = policy.maxScore;
    const minScore = policy.minScore;
    const nextScore = dto.score ?? row.score;
    if (nextScore < minScore || nextScore > maxScore) {
      throw new BadRequestException(`Score must be between ${minScore} and ${maxScore}`);
    }

    const updated = await this.prisma.rating.update({
      where: { id },
      data: {
        ...(dto.score != null ? { score: dto.score } : {}),
        ...(dto.comment !== undefined ? { comment: dto.comment } : {}),
        ...(dto.score != null || dto.comment !== undefined ? { maxScore } : {}),
      },
    });

    await this.audit.write({
      action: 'UPDATE',
      entityType: 'Rating',
      entityId: id,
      tenantId: updated.tenantId,
      branchId: updated.branchId ?? undefined,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
      summary: 'Rating updated',
      changes: dto as object as Prisma.InputJsonValue,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }
}
