import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { BusinessCategory, ConversationChannel, Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/types/request-user.type';
import { userIsSuperAdmin } from '../auth/types/request-user.type';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AssistanceRequestsService } from '../beauty-grooming/assistance-requests/assistance-requests.service';
import {
  BeautyGroomingConversationEngine,
  type BeautyEngineSideEffect,
} from '../beauty-grooming/beauty-grooming-conversation.engine';
import { BillRequestsService } from '../food-dining/bill-requests/bill-requests.service';
import { DiningSupportRequestsService } from '../food-dining/dining-support/dining-support-requests.service';
import {
  FoodDiningConversationEngine,
  type FoodEngineSideEffect,
} from '../food-dining/food-dining-conversation.engine';
import { WaiterCallsService } from '../food-dining/waiter-calls/waiter-calls.service';
import { QrResolverService } from '../qr/qr-resolver.service';
import { RatingsService } from '../ratings/ratings.service';
import { TenantAccessService } from '../tenants/tenant-access.service';
import {
  ConversationEngineService,
  isDualVerticalTenant,
  type SessionBizMeta,
} from './conversation-engine.service';
import { normalizeLang, type LangCode } from './conversation-i18n';
import type { ConversationMessageDto } from './dto/conversation-message.dto';
import type { ListConversationSessionsQueryDto } from './dto/list-sessions-query.dto';
import type { StartConversationDto } from './dto/start-conversation.dto';
import { SessionService } from './session.service';

function readBizMeta(metadata: unknown, tenantName: string): SessionBizMeta {
  const m = metadata as Record<string, unknown> | null | undefined;
  let enabledVerticals: ('FOOD_DINING' | 'BEAUTY_GROOMING')[] | undefined;
  if (m && Array.isArray(m.enabledVerticals)) {
    const raw = m.enabledVerticals.filter(
      (x): x is 'FOOD_DINING' | 'BEAUTY_GROOMING' =>
        x === 'FOOD_DINING' || x === 'BEAUTY_GROOMING',
    );
    if (raw.length > 0) {
      enabledVerticals = raw;
    }
  }
  if (
    m &&
    typeof m.businessName === 'string' &&
    (m.primaryCategory === 'FOOD_DINING' || m.primaryCategory === 'BEAUTY_GROOMING')
  ) {
    return {
      businessName: m.businessName,
      primaryCategory: m.primaryCategory,
      hostName: m.hostName === null ? null : typeof m.hostName === 'string' ? m.hostName : undefined,
      enabledVerticals,
    };
  }
  return { businessName: tenantName, primaryCategory: 'FOOD_DINING', enabledVerticals };
}

type SessionRow = {
  id: string;
  tenantId: string;
  branchId: string | null;
  channel: ConversationChannel;
  currentState: string;
  menuState: unknown;
  language: string;
  qrContext: unknown;
  expiresAt: Date | null;
  lastActivityAt: Date | null;
  lastInboundAt: Date | null;
  metadata: unknown;
  externalCustomerId: string | null;
  qrCodeId: string | null;
  staffId: string | null;
  diningTableId: string | null;
  beautyStationId: string | null;
};

type MessageRow = {
  id: string;
  sessionId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body: string;
  payload: unknown;
  createdAt: Date;
};

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: QrResolverService,
    private readonly sessions: SessionService,
    private readonly engine: ConversationEngineService,
    private readonly foodEngine: FoodDiningConversationEngine,
    private readonly beautyEngine: BeautyGroomingConversationEngine,
    private readonly waiterCalls: WaiterCallsService,
    private readonly billRequests: BillRequestsService,
    private readonly diningSupport: DiningSupportRequestsService,
    private readonly assistanceRequests: AssistanceRequestsService,
    private readonly tenantAccess: TenantAccessService,
    private readonly ratings: RatingsService,
  ) {}

  /** Staff / support: includes internal ids. */
  private mapSessionStaff(s: SessionRow) {
    return {
      id: s.id,
      tenantId: s.tenantId,
      branchId: s.branchId,
      channel: s.channel,
      currentState: s.currentState,
      menuState: s.menuState,
      language: s.language,
      qrContext: s.qrContext,
      expiresAt: s.expiresAt,
      lastActivityAt: s.lastActivityAt,
      lastInboundAt: s.lastInboundAt,
      metadata: s.metadata,
      externalCustomerId: s.externalCustomerId,
      qrCodeId: s.qrCodeId,
      staffId: s.staffId,
      diningTableId: s.diningTableId,
      beautyStationId: s.beautyStationId,
    };
  }

  /** Customer channel: no internal row ids or tenant/QR linkage ids. */
  private mapSessionCustomer(s: SessionRow) {
    return {
      currentState: s.currentState,
      menuState: s.menuState,
      language: s.language,
      expiresAt: s.expiresAt,
      lastActivityAt: s.lastActivityAt,
      lastInboundAt: s.lastInboundAt,
      metadata: s.metadata,
    };
  }

  private mapMessage(row: MessageRow) {
    return {
      id: row.id,
      sessionId: row.sessionId,
      direction: row.direction,
      body: row.body,
      payload: row.payload,
      createdAt: row.createdAt,
    };
  }

  /** Merge tenant categories when session metadata predates `enabledVerticals`. */
  private async enrichBizMeta(tenantId: string, meta: SessionBizMeta): Promise<SessionBizMeta> {
    if (isDualVerticalTenant(meta)) {
      return meta;
    }
    const cats = await this.prisma.tenantCategory.findMany({
      where: { tenantId, enabled: true },
    });
    const ev: ('FOOD_DINING' | 'BEAUTY_GROOMING')[] = [];
    if (cats.some((c) => c.category === 'FOOD_DINING')) {
      ev.push('FOOD_DINING');
    }
    if (cats.some((c) => c.category === 'BEAUTY_GROOMING')) {
      ev.push('BEAUTY_GROOMING');
    }
    if (ev.length > 1) {
      return { ...meta, enabledVerticals: ev };
    }
    return meta;
  }

  async start(dto: StartConversationDto) {
    const resolved = await this.resolver.resolveSecretToken(dto.qrToken);
    if (!resolved.ok) {
      throw new UnauthorizedException('Invalid QR token');
    }
    const ctx = resolved.context;
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: ctx.tenantId, deletedAt: null },
    });
    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    const cats = await this.prisma.tenantCategory.findMany({
      where: { tenantId: ctx.tenantId, enabled: true },
    });
    const primary =
      cats.find((c) => c.category === 'FOOD_DINING') ??
      cats.find((c) => c.category === 'BEAUTY_GROOMING');
    if (!primary) {
      throw new BadRequestException('Tenant has no enabled business category');
    }
    const enabledVerticals: ('FOOD_DINING' | 'BEAUTY_GROOMING')[] = [];
    if (cats.some((c) => c.category === 'FOOD_DINING')) {
      enabledVerticals.push('FOOD_DINING');
    }
    if (cats.some((c) => c.category === 'BEAUTY_GROOMING')) {
      enabledVerticals.push('BEAUTY_GROOMING');
    }

    let hostName: string | null = null;
    if (ctx.staffId) {
      const st = await this.prisma.staff.findFirst({
        where: { id: ctx.staffId, tenantId: ctx.tenantId, deletedAt: null },
      });
      hostName = st?.displayName ?? null;
    }

    const rawSessionToken = this.sessions.generateClientToken();
    const clientTokenHash = this.sessions.clientTokenHash(rawSessionToken);
    const expiresAt = this.sessions.defaultExpiresAt();
    const lang = normalizeLang(dto.language);

    const session = await this.prisma.conversationSession.create({
      data: {
        tenantId: ctx.tenantId,
        branchId: ctx.branchId,
        channel: dto.channel ?? 'API',
        externalCustomerId: dto.externalCustomerId?.trim(),
        qrCodeId: ctx.qrCodeId,
        staffId: ctx.staffId,
        diningTableId: ctx.diningTableId,
        beautyStationId: ctx.beautyStationId,
        currentState: 'ENTRY',
        menuState: { stack: [] },
        language: lang,
        qrContext: ctx as object,
        clientTokenHash,
        expiresAt,
        lastActivityAt: new Date(),
        metadata: {
          businessName: tenant.name,
          primaryCategory: primary.category,
          hostName,
          enabledVerticals: enabledVerticals.length > 1 ? enabledVerticals : undefined,
        },
      },
    });

    return {
      sessionToken: rawSessionToken,
      expiresAt: session.expiresAt,
      currentState: session.currentState,
      language: session.language,
    };
  }

  async message(dto: ConversationMessageDto) {
    let session = await this.sessions.loadForCustomerByToken(dto.sessionToken);

    if (dto.newQrToken?.trim()) {
      const next = await this.resolver.resolveSecretToken(dto.newQrToken);
      if (!next.ok) {
        throw new UnauthorizedException('Invalid new QR token');
      }
      const nctx = next.context;
      if (nctx.tenantId !== session.tenantId) {
        throw new BadRequestException('QR belongs to a different tenant');
      }
      let hostName: string | null = null;
      if (nctx.staffId) {
        const st = await this.prisma.staff.findFirst({
          where: { id: nctx.staffId, tenantId: nctx.tenantId, deletedAt: null },
        });
        hostName = st?.displayName ?? null;
      }
      const tenant = await this.prisma.tenant.findFirstOrThrow({
        where: { id: session.tenantId, deletedAt: null },
      });
      const cats = await this.prisma.tenantCategory.findMany({
        where: { tenantId: session.tenantId, enabled: true },
      });
      const primary =
        cats.find((c) => c.category === 'FOOD_DINING') ??
        cats.find((c) => c.category === 'BEAUTY_GROOMING');
      const enabledVerticals: ('FOOD_DINING' | 'BEAUTY_GROOMING')[] = [];
      if (cats.some((c) => c.category === 'FOOD_DINING')) {
        enabledVerticals.push('FOOD_DINING');
      }
      if (cats.some((c) => c.category === 'BEAUTY_GROOMING')) {
        enabledVerticals.push('BEAUTY_GROOMING');
      }
      session = await this.prisma.conversationSession.update({
        where: { id: session.id },
        data: {
          qrCodeId: nctx.qrCodeId,
          branchId: nctx.branchId,
          staffId: nctx.staffId,
          diningTableId: nctx.diningTableId,
          beautyStationId: nctx.beautyStationId,
          qrContext: nctx as object,
          currentState: 'ENTRY',
          menuState: { stack: [] },
          metadata: {
            businessName: tenant.name,
            primaryCategory: primary?.category ?? 'FOOD_DINING',
            hostName,
            enabledVerticals: enabledVerticals.length > 1 ? enabledVerticals : undefined,
          },
        },
      });
    }

    const tenant = await this.prisma.tenant.findFirstOrThrow({
      where: { id: session.tenantId, deletedAt: null },
    });
    const meta = await this.enrichBizMeta(session.tenantId, readBizMeta(session.metadata, tenant.name));

    let currentState = session.currentState;
    let menuState: unknown = session.menuState;
    if (meta.primaryCategory === 'FOOD_DINING' && currentState === 'FOOD_VIEW_MENU') {
      currentState = 'FOOD_MENU_CATEGORIES';
      const prev = menuState as { stack?: string[] } | null;
      const st = Array.isArray(prev?.stack) ? [...(prev!.stack as string[])] : [];
      menuState = { stack: st.length ? st : ['MAIN_MENU'], food: { orderedCategoryIds: [] } };
    }
    if (meta.primaryCategory === 'BEAUTY_GROOMING' && currentState === 'BEAUTY_VIEW_SERVICES') {
      currentState = 'BEAUTY_MENU_CATEGORIES';
      const prev = menuState as { stack?: string[] } | null;
      const st = Array.isArray(prev?.stack) ? [...(prev!.stack as string[])] : [];
      menuState = { stack: st.length ? st : ['MAIN_MENU'], beauty: { orderedCategoryIds: [] } };
    }

    const auditCtx = {
      correlationId: undefined as string | undefined,
      ipAddress: undefined as string | undefined,
      userAgent: undefined as string | undefined,
    };

    let engineOut: {
      reply: string;
      nextState: string;
      nextMenuState: Prisma.InputJsonValue;
      nextLanguage?: LangCode;
    };
    const foodSideEffects: FoodEngineSideEffect[] = [];
    const beautySideEffects: BeautyEngineSideEffect[] = [];

    const ratingPolicy = await this.ratings.getPolicyForVertical(
      session.tenantId,
      meta.primaryCategory as BusinessCategory,
    );

    if (meta.primaryCategory === 'FOOD_DINING') {
      const foodOut = await this.foodEngine.run(
        dto.text,
        currentState,
        menuState,
        session.language,
        meta,
        {
          id: session.id,
          tenantId: session.tenantId,
          branchId: session.branchId,
          diningTableId: session.diningTableId,
          staffId: session.staffId,
          externalCustomerId: session.externalCustomerId,
        },
        { ratingPolicy },
      );
      engineOut = foodOut;
      foodSideEffects.push(...foodOut.sideEffects);
    } else if (meta.primaryCategory === 'BEAUTY_GROOMING') {
      const beautyOut = await this.beautyEngine.run(
        dto.text,
        currentState,
        menuState,
        session.language,
        meta,
        {
          id: session.id,
          tenantId: session.tenantId,
          branchId: session.branchId,
          beautyStationId: session.beautyStationId,
          staffId: session.staffId,
          externalCustomerId: session.externalCustomerId,
        },
        { ratingPolicy },
      );
      engineOut = beautyOut;
      beautySideEffects.push(...beautyOut.sideEffects);
    } else {
      engineOut = this.engine.run(dto.text, currentState, menuState, session.language, meta);
    }

    const nextLang = engineOut.nextLanguage ?? normalizeLang(session.language);

    await this.prisma.conversationMessage.create({
      data: {
        sessionId: session.id,
        direction: 'INBOUND',
        body: dto.text,
      },
    });

    let primaryOverride: 'FOOD_DINING' | 'BEAUTY_GROOMING' | undefined;
    for (const se of foodSideEffects) {
      if (se.type === 'SWITCH_VERTICAL') {
        primaryOverride = se.to;
      }
    }
    for (const se of beautySideEffects) {
      if (se.type === 'SWITCH_VERTICAL') {
        primaryOverride = se.to;
      }
    }
    const baseMeta =
      session.metadata && typeof session.metadata === 'object' && !Array.isArray(session.metadata)
        ? { ...(session.metadata as Record<string, unknown>) }
        : {};
    const metadataPatch =
      primaryOverride != null
        ? ({
            ...baseMeta,
            primaryCategory: primaryOverride,
            ...(meta.enabledVerticals && meta.enabledVerticals.length > 1
              ? { enabledVerticals: meta.enabledVerticals }
              : {}),
          } satisfies Record<string, unknown>)
        : undefined;

    const updated = await this.prisma.conversationSession.update({
      where: { id: session.id },
      data: {
        currentState: engineOut.nextState,
        menuState: engineOut.nextMenuState,
        language: nextLang,
        lastInboundAt: new Date(),
        lastActivityAt: new Date(),
        ...(metadataPatch != null ? { metadata: metadataPatch as Prisma.InputJsonValue } : {}),
      },
    });

    const branchId = updated.branchId;
    if (branchId) {
      for (const se of foodSideEffects) {
        if (se.type === 'WAITER_CALL') {
          await this.waiterCalls.createFromSession(
            {
              tenantId: updated.tenantId,
              branchId,
              tableId: updated.diningTableId,
              sessionId: updated.id,
            },
            auditCtx,
          );
        } else if (se.type === 'BILL_REQUEST') {
          await this.billRequests.createFromSession(
            {
              tenantId: updated.tenantId,
              branchId,
              tableId: updated.diningTableId,
              sessionId: updated.id,
            },
            auditCtx,
          );
        } else if (se.type === 'DINING_SUPPORT') {
          await this.diningSupport.createFromSession(
            {
              tenantId: updated.tenantId,
              branchId,
              sessionId: updated.id,
            },
            auditCtx,
          );
        }
      }
      for (const se of beautySideEffects) {
        if (se.type === 'BEAUTY_ASSISTANCE') {
          await this.assistanceRequests.createFromSession(
            {
              tenantId: updated.tenantId,
              branchId,
              sessionId: updated.id,
              stationId: updated.beautyStationId,
              staffId: updated.staffId,
              supportKind: se.supportKind,
            },
            auditCtx,
          );
        }
      }
    }

    await this.prisma.conversationMessage.create({
      data: {
        sessionId: session.id,
        direction: 'OUTBOUND',
        body: engineOut.reply,
      },
    });

    return {
      reply: engineOut.reply,
      session: this.mapSessionCustomer(updated as SessionRow),
    };
  }

  async getCustomerSession(sessionToken: string) {
    const session = await this.sessions.loadForCustomerByToken(sessionToken);
    return this.mapSessionCustomer(session as SessionRow);
  }

  async resetCustomerSession(sessionToken: string) {
    const session = await this.sessions.loadForCustomerByToken(sessionToken);
    await this.prisma.conversationMessage.deleteMany({ where: { sessionId: session.id } });
    const updated = await this.prisma.conversationSession.update({
      where: { id: session.id },
      data: {
        currentState: 'ENTRY',
        menuState: { stack: [] },
        lastActivityAt: new Date(),
      },
    });
    return { session: this.mapSessionCustomer(updated as SessionRow) };
  }

  async getSessionForStaff(sessionId: string, user: AuthUser) {
    const session = await this.prisma.conversationSession.findFirst({
      where: { id: sessionId, deletedAt: null },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    this.sessions.assertNotExpired(session.expiresAt);
    if (!userIsSuperAdmin(user)) {
      await this.tenantAccess.assertReadableTenant(user, session.tenantId);
    }
    return this.mapSessionStaff(session as SessionRow);
  }

  async getSessionMessagesForStaff(sessionId: string, user: AuthUser) {
    const session = await this.prisma.conversationSession.findFirst({
      where: { id: sessionId, deletedAt: null },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    this.sessions.assertNotExpired(session.expiresAt);
    if (!userIsSuperAdmin(user)) {
      await this.tenantAccess.assertReadableTenant(user, session.tenantId);
    }
    const items = await this.prisma.conversationMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 250,
    });
    return items.map((item) => this.mapMessage(item as MessageRow));
  }

  async resetSessionForStaff(sessionId: string, user: AuthUser) {
    const session = await this.prisma.conversationSession.findFirst({
      where: { id: sessionId, deletedAt: null },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    this.sessions.assertNotExpired(session.expiresAt);
    if (!userIsSuperAdmin(user)) {
      await this.tenantAccess.assertReadableTenant(user, session.tenantId);
    }
    await this.prisma.conversationMessage.deleteMany({ where: { sessionId } });
    const updated = await this.prisma.conversationSession.update({
      where: { id: sessionId },
      data: {
        currentState: 'ENTRY',
        menuState: { stack: [] },
        lastActivityAt: new Date(),
      },
    });
    return { session: this.mapSessionStaff(updated as SessionRow) };
  }

  async listSessionsForStaff(user: AuthUser, q: ListConversationSessionsQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 30;
    if (pageSize > 200) {
      throw new BadRequestException('pageSize too large');
    }

    if (userIsSuperAdmin(user) && !q.tenantId) {
      const [items, total] = await Promise.all([
        this.prisma.conversationSession.findMany({
          where: { deletedAt: null },
          orderBy: { lastActivityAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.conversationSession.count({ where: { deletedAt: null } }),
      ]);
      return { page, pageSize, total, items: items.map((s) => this.mapSessionStaff(s as SessionRow)) };
    }

    if (!q.tenantId?.trim()) {
      throw new BadRequestException('tenantId is required');
    }
    await this.tenantAccess.assertReadableTenant(user, q.tenantId);

    const where = { tenantId: q.tenantId, deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.conversationSession.findMany({
        where,
        orderBy: { lastActivityAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.conversationSession.count({ where }),
    ]);
    return { page, pageSize, total, items: items.map((s) => this.mapSessionStaff(s as SessionRow)) };
  }
}
