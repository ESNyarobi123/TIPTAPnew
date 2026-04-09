import { ConflictException, HttpException, Injectable } from '@nestjs/common';
import type { Prisma, RatingTargetType } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  formatNumberedMenu,
  normalizeLang,
  t,
  type LangCode,
} from '../conversations/conversation-i18n';
import {
  isDualVerticalTenant,
  type SessionBizMeta,
} from '../conversations/conversation-engine.service';
import { DEFAULT_RATING_POLICY, type ResolvedRatingPolicy } from '../ratings/rating-policy';
import { PaymentsService } from '../payments/payments.service';
import { RatingsService } from '../ratings/ratings.service';
import { TipsService } from '../tips/tips.service';
import { BeautyBookingsService } from './beauty-bookings/beauty-bookings.service';

export type BeautySessionContext = {
  id: string;
  tenantId: string;
  branchId: string | null;
  beautyStationId: string | null;
  staffId: string | null;
  externalCustomerId: string | null;
};

export type BeautyEngineSideEffect =
  | { type: 'BEAUTY_ASSISTANCE'; supportKind: 'RECEPTION' | 'CUSTOMER_SUPPORT' }
  | { type: 'SWITCH_VERTICAL'; to: 'FOOD_DINING' };

export type BeautyEngineRunResult = {
  reply: string;
  nextState: string;
  nextMenuState: Prisma.InputJsonValue;
  nextLanguage?: LangCode;
  sideEffects: BeautyEngineSideEffect[];
};

type BeautyRatingChoice = { digit: string; kind: RatingTargetType };

type BeautyRatingDraft = {
  targetType?: RatingTargetType;
  targetId?: string;
  score?: number;
  orderedCategoryIds?: string[];
  servicesCategoryId?: string;
  orderedServiceIds?: string[];
};

type MenuStack = { stack: string[]; beauty?: BeautyMenuPayload };
type BeautyMenuPayload = {
  orderedCategoryIds: string[];
  servicesCategoryId?: string;
  rating?: BeautyRatingDraft;
  ratingChoices?: BeautyRatingChoice[];
  tipAmountCents?: number;
  payTotalCents?: number;
  payCurrency?: string;
  payBookingId?: string;
  pendingPaymentTxnId?: string;
};

function parseMenuState(menuState: unknown): MenuStack {
  if (menuState && typeof menuState === 'object') {
    const o = menuState as Record<string, unknown>;
    const stack = Array.isArray(o.stack) ? [...(o.stack as string[])] : [];
    const beauty = o.beauty && typeof o.beauty === 'object' ? (o.beauty as BeautyMenuPayload) : undefined;
    return { stack, beauty };
  }
  return { stack: [] };
}

function fmtPrice(priceCents: number | null, currency: string | null, lang: LangCode): string {
  if (priceCents == null) {
    return lang === 'sw' ? 'bei —' : 'on request';
  }
  const cur = (currency ?? 'USD').toUpperCase();
  return `${(priceCents / 100).toFixed(2)} ${cur}`;
}

function httpErrorMessage(e: unknown): string {
  if (e instanceof HttpException) {
    const r = e.getResponse();
    if (typeof r === 'string') {
      return r;
    }
    if (typeof r === 'object' && r && 'message' in r) {
      const m = (r as { message?: string | string[] }).message;
      return Array.isArray(m) ? String(m[0]) : String(m ?? e.message);
    }
    return e.message;
  }
  return e instanceof Error ? e.message : 'Error';
}

@Injectable()
export class BeautyGroomingConversationEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ratings: RatingsService,
    private readonly beautyBookings: BeautyBookingsService,
    private readonly payments: PaymentsService,
    private readonly tips: TipsService,
  ) {}

  private normalizeMsisdnTz(raw: string): string | null {
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 9) {
      return null;
    }
    if (digits.startsWith('255')) {
      return digits;
    }
    if (digits.startsWith('0')) {
      return `255${digits.slice(1)}`;
    }
    if (digits.length === 9 && /^[67]/.test(digits)) {
      return `255${digits}`;
    }
    return digits.length >= 10 ? digits : null;
  }

  private branchWhere(branchId: string | null): { OR: object[] } | { branchId: null } {
    if (branchId) {
      return { OR: [{ branchId: null }, { branchId }] };
    }
    return { branchId: null };
  }

  private async loadCategories(tenantId: string, branchId: string | null) {
    return this.prisma.beautyServiceCategory.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        ...this.branchWhere(branchId),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  private async loadServices(tenantId: string, branchId: string | null, categoryId: string) {
    return this.prisma.beautyService.findMany({
      where: {
        tenantId,
        categoryId,
        deletedAt: null,
        ...this.branchWhere(branchId),
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  private formatCategoryList(lang: LangCode, categories: { id: string; name: string }[]): {
    text: string;
    ids: string[];
  } {
    const s = t(lang);
    if (categories.length === 0) {
      return { text: s.beautyNoCategories, ids: [] };
    }
    const lines: string[] = [s.beautyCategoriesTitle, ''];
    const ids: string[] = [];
    categories.forEach((c, i) => {
      ids.push(c.id);
      lines.push(`${i + 1} — ${c.name}`);
    });
    lines.push('');
    lines.push(lang === 'sw' ? '0 — Rudi menyu kuu' : '0 — Main menu');
    return { text: lines.join('\n'), ids };
  }

  private formatServiceList(
    lang: LangCode,
    categoryName: string,
    items: {
      id: string;
      name: string;
      priceCents: number | null;
      currency: string | null;
      durationMin: number | null;
      isActive: boolean;
    }[],
  ): { text: string; ids: string[] } {
    const s = t(lang);
    if (items.length === 0) {
      return { text: s.beautyNoServices, ids: [] };
    }
    const lines: string[] = [`${s.beautyServicesTitle}: ${categoryName}`, ''];
    const ids: string[] = [];
    items.forEach((it, i) => {
      const price = fmtPrice(it.priceCents, it.currency, lang);
      const dur =
        it.durationMin != null
          ? lang === 'sw'
            ? `, ${it.durationMin} dk`
            : `, ${it.durationMin} min`
          : '';
      const avail = it.isActive ? '' : ` (${s.beautyUnavailable})`;
      ids.push(it.id);
      lines.push(`${i + 1} — ${it.name} — ${price}${dur}${avail}`);
    });
    lines.push('');
    lines.push(lang === 'sw' ? '0 — Rudi kwa makundi' : '0 — Back to categories');
    return { text: lines.join('\n'), ids };
  }

  private beautyRatingTargetMenu(
    lang: LangCode,
    session: BeautySessionContext,
    policy: ResolvedRatingPolicy,
  ): { text: string; choices: BeautyRatingChoice[] } {
    const s = t(lang);
    const lines: string[] = [s.ratingTargetTitle, ''];
    const choices: BeautyRatingChoice[] = [];
    let n = 1;
    const order: RatingTargetType[] = [
      'BUSINESS',
      'PROVIDER_EXPERIENCE',
      'STAFF',
      'SERVICE',
    ];
    for (const kind of order) {
      if (!policy.allowedTargets.includes(kind)) {
        continue;
      }
      if (kind === 'BUSINESS') {
        lines.push(`${n} — ${s.ratingOptBusiness}`);
        choices.push({ digit: String(n), kind: 'BUSINESS' });
        n += 1;
      } else if (kind === 'PROVIDER_EXPERIENCE') {
        lines.push(`${n} — ${s.ratingOptProvider}`);
        choices.push({ digit: String(n), kind: 'PROVIDER_EXPERIENCE' });
        n += 1;
      } else if (kind === 'STAFF') {
        lines.push(`${n} — ${s.ratingOptStaffAlt}`);
        choices.push({ digit: String(n), kind: 'STAFF' });
        n += 1;
      } else if (kind === 'SERVICE') {
        lines.push(`${n} — ${s.ratingOptService}`);
        choices.push({ digit: String(n), kind: 'SERVICE' });
        n += 1;
      }
    }
    lines.push('');
    lines.push(lang === 'sw' ? '0 — Rudi menyu kuu' : '0 — Main menu');
    return { text: lines.join('\n'), choices };
  }

  private async submitBeautyRating(
    session: BeautySessionContext,
    targetType: RatingTargetType,
    targetId: string,
    score: number,
    comment: string | null,
    lang: LangCode,
  ): Promise<BeautyEngineRunResult> {
    const s = t(lang);
    try {
      await this.ratings.createFromConversation(
        {
          tenantId: session.tenantId,
          branchId: session.branchId,
          sessionId: session.id,
          vertical: 'BEAUTY_GROOMING',
          targetType,
          targetId,
          score,
          comment,
        },
        {},
      );
      return {
        reply: s.ratingThanks,
        nextState: 'MAIN_MENU',
        nextMenuState: { stack: [] },
        sideEffects: [],
      };
    } catch (e) {
      if (e instanceof ConflictException) {
        return {
          reply: s.ratingDuplicate,
          nextState: 'MAIN_MENU',
          nextMenuState: { stack: [] },
          sideEffects: [],
        };
      }
      return {
        reply: httpErrorMessage(e),
        nextState: 'MAIN_MENU',
        nextMenuState: { stack: [] },
        sideEffects: [],
      };
    }
  }

  private showMainMenu(
    lang: LangCode,
    meta: SessionBizMeta,
    pendingPaymentTxnId?: string | null,
  ): BeautyEngineRunResult {
    const dual = isDualVerticalTenant(meta);
    const extras: { digit: string; label: string }[] = [];
    if (dual) {
      extras.push({ digit: '7', label: t(lang).optSwitchToFood });
    }
    extras.push({ digit: dual ? '8' : '7', label: t(lang).optTipProvider });
    extras.push({ digit: dual ? '9' : '8', label: t(lang).optPayVisitUssd });
    let reply = formatNumberedMenu(lang, 'BEAUTY_GROOMING', meta.businessName, meta.hostName, extras);
    if (pendingPaymentTxnId) {
      reply += `\n\n${t(lang).payStatusHint}`;
    }
    return {
      reply,
      nextState: 'MAIN_MENU',
      nextMenuState: pendingPaymentTxnId
        ? { stack: [], beauty: { pendingPaymentTxnId } }
        : { stack: [] },
      sideEffects: [],
    };
  }

  async run(
    text: string,
    currentState: string,
    menuState: unknown,
    language: string,
    meta: SessionBizMeta,
    session: BeautySessionContext,
    opts?: { ratingPolicy?: ResolvedRatingPolicy },
  ): Promise<BeautyEngineRunResult> {
    const lang = normalizeLang(language);
    const s = t(lang);
    const d = text.trim();
    const parsed = parseMenuState(menuState);
    const stack = parsed.stack;
    const beauty = parsed.beauty;
    const ratingPolicy = opts?.ratingPolicy ?? DEFAULT_RATING_POLICY;

    const requireBranch = (): string | null => session.branchId;

    if ((d === 'P' || d === 'p') && beauty?.pendingPaymentTxnId) {
      try {
        const refreshed = await this.payments.refreshTransactionStatusFromSession(
          session.id,
          beauty.pendingPaymentTxnId,
        );
        const stillPending =
          refreshed.status !== 'COMPLETED' && refreshed.status !== 'FAILED'
            ? beauty.pendingPaymentTxnId
            : undefined;
        let msg: string;
        if (refreshed.status === 'COMPLETED') {
          msg = s.beautyPayCompleted;
        } else if (refreshed.status === 'FAILED') {
          msg = s.beautyPayFailed;
        } else {
          msg = s.beautyPayStillPending;
        }
        return {
          reply: msg,
          nextState: 'MAIN_MENU',
          nextMenuState: {
            stack: [],
            beauty: stillPending ? { pendingPaymentTxnId: stillPending } : {},
          },
          sideEffects: [],
        };
      } catch (e) {
        return {
          reply: httpErrorMessage(e),
          nextState: 'MAIN_MENU',
          nextMenuState: {
            stack: [],
            beauty: { pendingPaymentTxnId: beauty.pendingPaymentTxnId },
          },
          sideEffects: [],
        };
      }
    }

    if (d === '0') {
      if (currentState === 'BEAUTY_RATING_SERVICE_PICK') {
        const catId = beauty?.rating?.servicesCategoryId;
        if (!catId) {
          return this.showMainMenu(lang, meta, beauty?.pendingPaymentTxnId);
        }
        const cats = await this.loadCategories(session.tenantId, session.branchId);
        const { text: catText, ids } = this.formatCategoryList(lang, cats);
        return {
          reply: catText,
          nextState: 'BEAUTY_RATING_SERVICE_CATEGORY',
          nextMenuState: {
            stack,
            beauty: {
              orderedCategoryIds: beauty?.orderedCategoryIds ?? [],
              servicesCategoryId: beauty?.servicesCategoryId,
              rating: { ...beauty?.rating, orderedCategoryIds: ids, servicesCategoryId: undefined, orderedServiceIds: undefined },
              ratingChoices: beauty?.ratingChoices,
            },
          },
          sideEffects: [],
        };
      }
      if (currentState === 'BEAUTY_RATING_SERVICE_CATEGORY') {
        const { text: rtext, choices } = this.beautyRatingTargetMenu(lang, session, ratingPolicy);
        return {
          reply: rtext,
          nextState: 'BEAUTY_RATING_TARGET',
          nextMenuState: { stack, beauty: { orderedCategoryIds: [], ratingChoices: choices } },
          sideEffects: [],
        };
      }
      if (currentState === 'BEAUTY_RATING_SCORE' || currentState === 'BEAUTY_RATING_COMMENT') {
        const { text: rtext, choices } = this.beautyRatingTargetMenu(lang, session, ratingPolicy);
        return {
          reply: rtext,
          nextState: 'BEAUTY_RATING_TARGET',
          nextMenuState: { stack, beauty: { orderedCategoryIds: [], ratingChoices: choices } },
          sideEffects: [],
        };
      }
      if (currentState === 'BEAUTY_RATING_TARGET') {
        return this.showMainMenu(lang, meta, beauty?.pendingPaymentTxnId);
      }
      if (currentState === 'BEAUTY_MENU_SERVICES') {
        const cats = await this.loadCategories(session.tenantId, session.branchId);
        const { text: catText, ids } = this.formatCategoryList(lang, cats);
        return {
          reply: catText,
          nextState: 'BEAUTY_MENU_CATEGORIES',
          nextMenuState: { stack, beauty: { orderedCategoryIds: ids } },
          sideEffects: [],
        };
      }
      if (currentState === 'BEAUTY_MENU_CATEGORIES') {
        return this.showMainMenu(lang, meta, beauty?.pendingPaymentTxnId);
      }
      if (stack.length === 0) {
        return {
          reply: s.atRoot,
          nextState: currentState === 'ENTRY' ? 'ENTRY' : 'MAIN_MENU',
          nextMenuState: { stack: [] },
          sideEffects: [],
        };
      }
      const prev = stack.pop()!;
      if (prev === 'MAIN_MENU') {
        return this.showMainMenu(lang, meta, beauty?.pendingPaymentTxnId);
      }
      return {
        reply: s.back,
        nextState: prev,
        nextMenuState: { stack, beauty },
        sideEffects: [],
      };
    }

    if (currentState === 'ENTRY') {
      if (d === '1') {
        return this.showMainMenu(lang, meta, beauty?.pendingPaymentTxnId);
      }
      return {
        reply: s.entryOpenBeauty(meta.businessName, meta.hostName),
        nextState: 'ENTRY',
        nextMenuState: { stack: [] },
        sideEffects: [],
      };
    }

    if (currentState === 'LANGUAGE_SELECT') {
      if (d === '1') {
        return {
          reply: s.languageSet('English'),
          nextLanguage: 'en',
          nextState: 'MAIN_MENU',
          nextMenuState: {
            stack: [],
            ...(beauty?.pendingPaymentTxnId
              ? { beauty: { pendingPaymentTxnId: beauty.pendingPaymentTxnId } }
              : {}),
          },
          sideEffects: [],
        };
      }
      if (d === '2') {
        return {
          reply: s.languageSet('Kiswahili'),
          nextLanguage: 'sw',
          nextState: 'MAIN_MENU',
          nextMenuState: {
            stack: [],
            ...(beauty?.pendingPaymentTxnId
              ? { beauty: { pendingPaymentTxnId: beauty.pendingPaymentTxnId } }
              : {}),
          },
          sideEffects: [],
        };
      }
      return {
        reply: s.languageMenu,
        nextState: 'LANGUAGE_SELECT',
        nextMenuState: { stack },
        sideEffects: [],
      };
    }

    if (currentState === 'BEAUTY_RATING_TARGET') {
      const choices = beauty?.ratingChoices ?? [];
      const hit = choices.find((c) => c.digit === d);
      if (!hit) {
        const { text: rtext, choices: ch } = this.beautyRatingTargetMenu(lang, session, ratingPolicy);
        return {
          reply: rtext,
          nextState: 'BEAUTY_RATING_TARGET',
          nextMenuState: { stack, beauty: { ...beauty, ratingChoices: ch } },
          sideEffects: [],
        };
      }
      if (hit.kind === 'BUSINESS') {
        return {
          reply: s.ratingScorePrompt(ratingPolicy.minScore, ratingPolicy.maxScore),
          nextState: 'BEAUTY_RATING_SCORE',
          nextMenuState: {
            stack,
            beauty: {
              orderedCategoryIds: beauty?.orderedCategoryIds ?? [],
              servicesCategoryId: beauty?.servicesCategoryId,
              rating: { targetType: 'BUSINESS', targetId: session.tenantId },
              ratingChoices: choices,
            },
          },
          sideEffects: [],
        };
      }
      if (hit.kind === 'PROVIDER_EXPERIENCE' || hit.kind === 'STAFF') {
        if (!session.staffId) {
          return {
            reply: s.ratingNoStaff,
            nextState: 'BEAUTY_RATING_TARGET',
            nextMenuState: { stack, beauty: { ...beauty, ratingChoices: choices } },
            sideEffects: [],
          };
        }
        return {
          reply: s.ratingScorePrompt(ratingPolicy.minScore, ratingPolicy.maxScore),
          nextState: 'BEAUTY_RATING_SCORE',
          nextMenuState: {
            stack,
            beauty: {
              orderedCategoryIds: beauty?.orderedCategoryIds ?? [],
              servicesCategoryId: beauty?.servicesCategoryId,
              rating: { targetType: hit.kind, targetId: session.staffId },
              ratingChoices: choices,
            },
          },
          sideEffects: [],
        };
      }
      const cats = await this.loadCategories(session.tenantId, session.branchId);
      const { text: catText, ids } = this.formatCategoryList(lang, cats);
      return {
        reply: catText,
        nextState: 'BEAUTY_RATING_SERVICE_CATEGORY',
        nextMenuState: {
          stack,
          beauty: {
            orderedCategoryIds: beauty?.orderedCategoryIds ?? [],
            rating: { ...beauty?.rating, orderedCategoryIds: ids },
            ratingChoices: choices,
          },
        },
        sideEffects: [],
      };
    }

    if (currentState === 'BEAUTY_RATING_SERVICE_CATEGORY') {
      const ids = beauty?.rating?.orderedCategoryIds ?? [];
      const n = Number.parseInt(d, 10);
      if (!Number.isFinite(n) || n < 1 || n > ids.length) {
        const cats = await this.loadCategories(session.tenantId, session.branchId);
        const { text: catText, ids: freshIds } = this.formatCategoryList(lang, cats);
        return {
          reply: catText,
          nextState: 'BEAUTY_RATING_SERVICE_CATEGORY',
          nextMenuState: {
            stack,
            beauty: {
              ...beauty,
              rating: { ...beauty?.rating, orderedCategoryIds: freshIds },
            },
          },
          sideEffects: [],
        };
      }
      const categoryId = ids[n - 1]!;
      const catRow = await this.prisma.beautyServiceCategory.findFirst({
        where: { id: categoryId, tenantId: session.tenantId, deletedAt: null },
      });
      const categoryName = catRow?.name ?? '—';
      const services = await this.loadServices(session.tenantId, session.branchId, categoryId);
      const { text: svcText, ids: svcIds } = this.formatServiceList(lang, categoryName, services);
      return {
        reply: svcText,
        nextState: 'BEAUTY_RATING_SERVICE_PICK',
        nextMenuState: {
          stack,
          beauty: {
            ...beauty,
            rating: {
              ...beauty?.rating,
              servicesCategoryId: categoryId,
              orderedServiceIds: svcIds,
            },
          },
        },
        sideEffects: [],
      };
    }

    if (currentState === 'BEAUTY_RATING_SERVICE_PICK') {
      const ids = beauty?.rating?.orderedServiceIds ?? [];
      const n = Number.parseInt(d, 10);
      if (!Number.isFinite(n) || n < 1 || n > ids.length) {
        const catId = beauty?.rating?.servicesCategoryId;
        if (!catId) {
          const { text: rtext, choices } = this.beautyRatingTargetMenu(lang, session, ratingPolicy);
          return {
            reply: rtext,
            nextState: 'BEAUTY_RATING_TARGET',
            nextMenuState: { stack, beauty: { ratingChoices: choices } },
            sideEffects: [],
          };
        }
        const catRow = await this.prisma.beautyServiceCategory.findFirst({
          where: { id: catId, tenantId: session.tenantId, deletedAt: null },
        });
        const categoryName = catRow?.name ?? '—';
        const services = await this.loadServices(session.tenantId, session.branchId, catId);
        const { text: svcText, ids: svcIds } = this.formatServiceList(lang, categoryName, services);
        const hint =
          lang === 'sw'
            ? '\n\nAndika nambari sahihi au 0 kurudi.'
            : '\n\nChoose a valid option or press 0 to go back.';
        return {
          reply: svcText + hint,
          nextState: 'BEAUTY_RATING_SERVICE_PICK',
          nextMenuState: {
            stack,
            beauty: { ...beauty, rating: { ...beauty?.rating, orderedServiceIds: svcIds } },
          },
          sideEffects: [],
        };
      }
      const svcId = ids[n - 1]!;
      return {
        reply: s.ratingScorePrompt(ratingPolicy.minScore, ratingPolicy.maxScore),
        nextState: 'BEAUTY_RATING_SCORE',
        nextMenuState: {
          stack,
          beauty: {
            ...beauty,
            rating: { targetType: 'SERVICE', targetId: svcId },
          },
        },
        sideEffects: [],
      };
    }

    if (currentState === 'BEAUTY_RATING_SCORE') {
      const rt = beauty?.rating?.targetType;
      const tid = beauty?.rating?.targetId;
      if (!rt || !tid) {
        const { text: rtext, choices } = this.beautyRatingTargetMenu(lang, session, ratingPolicy);
        return {
          reply: rtext,
          nextState: 'BEAUTY_RATING_TARGET',
          nextMenuState: { stack, beauty: { ratingChoices: choices } },
          sideEffects: [],
        };
      }
      const sc = Number.parseInt(d, 10);
      if (!Number.isFinite(sc) || sc < ratingPolicy.minScore || sc > ratingPolicy.maxScore) {
        return {
          reply: s.ratingScorePrompt(ratingPolicy.minScore, ratingPolicy.maxScore),
          nextState: 'BEAUTY_RATING_SCORE',
          nextMenuState: { stack, beauty },
          sideEffects: [],
        };
      }
      if (ratingPolicy.commentRequired) {
        return {
          reply: `${s.ratingCommentRequired}\n${s.ratingCommentPrompt}`,
          nextState: 'BEAUTY_RATING_COMMENT',
          nextMenuState: {
            stack,
            beauty: { ...beauty, rating: { ...beauty?.rating, score: sc } },
          },
          sideEffects: [],
        };
      }
      return this.submitBeautyRating(session, rt, tid, sc, null, lang);
    }

    if (currentState === 'BEAUTY_RATING_COMMENT') {
      const rt = beauty?.rating?.targetType;
      const tid = beauty?.rating?.targetId;
      const sc = beauty?.rating?.score;
      if (!rt || !tid || sc == null) {
        const { text: rtext, choices } = this.beautyRatingTargetMenu(lang, session, ratingPolicy);
        return {
          reply: rtext,
          nextState: 'BEAUTY_RATING_TARGET',
          nextMenuState: { stack, beauty: { ratingChoices: choices } },
          sideEffects: [],
        };
      }
      if (d === '0' || !d.trim()) {
        return {
          reply: `${s.ratingCommentRequired}\n${s.ratingCommentPrompt}`,
          nextState: 'BEAUTY_RATING_COMMENT',
          nextMenuState: { stack, beauty },
          sideEffects: [],
        };
      }
      return this.submitBeautyRating(session, rt, tid, sc, d.trim(), lang);
    }

    if (currentState === 'MAIN_MENU') {
      const langOpt = '4';
      const exitOpt = '5';
      const rateOpt = '6';

      if (d === langOpt) {
        stack.push('MAIN_MENU');
        return {
          reply: s.languageMenu,
          nextState: 'LANGUAGE_SELECT',
          nextMenuState: { stack },
          sideEffects: [],
        };
      }
      if (d === exitOpt) {
        return {
          reply: s.exitThanks,
          nextState: 'EXIT',
          nextMenuState: { stack: [] },
          sideEffects: [],
        };
      }

      if (d === rateOpt) {
        const { text: rtext, choices } = this.beautyRatingTargetMenu(lang, session, ratingPolicy);
        return {
          reply: rtext,
          nextState: 'BEAUTY_RATING_TARGET',
          nextMenuState: { stack, beauty: { orderedCategoryIds: [], ratingChoices: choices } },
          sideEffects: [],
        };
      }

      if (d === '1') {
        stack.push('MAIN_MENU');
        const cats = await this.loadCategories(session.tenantId, session.branchId);
        const { text: catText, ids } = this.formatCategoryList(lang, cats);
        return {
          reply: catText,
          nextState: 'BEAUTY_MENU_CATEGORIES',
          nextMenuState: { stack, beauty: { orderedCategoryIds: ids } },
          sideEffects: [],
        };
      }

      if (d === '2') {
        const b = requireBranch();
        if (!b) {
          return {
            reply: s.beautyNeedBranch,
            nextState: 'MAIN_MENU',
            nextMenuState: { stack: [] },
            sideEffects: [],
          };
        }
        return {
          reply: s.beautyAssistanceOk,
          nextState: 'MAIN_MENU',
          nextMenuState: { stack: [] },
          sideEffects: [{ type: 'BEAUTY_ASSISTANCE', supportKind: 'RECEPTION' }],
        };
      }

      if (d === '3') {
        const b = requireBranch();
        if (!b) {
          return {
            reply: s.beautyNeedBranch,
            nextState: 'MAIN_MENU',
            nextMenuState: { stack: [] },
            sideEffects: [],
          };
        }
        return {
          reply: s.beautySupportOk,
          nextState: 'MAIN_MENU',
          nextMenuState: { stack: [] },
          sideEffects: [{ type: 'BEAUTY_ASSISTANCE', supportKind: 'CUSTOMER_SUPPORT' }],
        };
      }

      const dual = isDualVerticalTenant(meta);
      const tipD = dual ? '8' : '7';
      const payD = dual ? '9' : '8';

      if (d === tipD) {
        if (!session.staffId) {
          return {
            reply: s.beautyTipNeedStaffQr,
            nextState: 'MAIN_MENU',
            nextMenuState: {
              stack: [],
              beauty: beauty?.pendingPaymentTxnId ? { pendingPaymentTxnId: beauty.pendingPaymentTxnId } : {},
            },
            sideEffects: [],
          };
        }
        return {
          reply: s.beautyTipAmountPrompt,
          nextState: 'BEAUTY_TIP_AMOUNT',
          nextMenuState: {
            stack,
            beauty: {
              pendingPaymentTxnId: beauty?.pendingPaymentTxnId,
            },
          },
          sideEffects: [],
        };
      }

      if (d === payD) {
        const b = requireBranch();
        if (!b) {
          return {
            reply: s.beautyNeedBranch,
            nextState: 'MAIN_MENU',
            nextMenuState: { stack: [] },
            sideEffects: [],
          };
        }
        const booking = await this.beautyBookings.findOpenBookingSummaryForSession(session.id);
        if (!booking) {
          return {
            reply: s.beautyPayNoBooking,
            nextState: 'MAIN_MENU',
            nextMenuState: {
              stack: [],
              beauty: beauty?.pendingPaymentTxnId ? { pendingPaymentTxnId: beauty.pendingPaymentTxnId } : {},
            },
            sideEffects: [],
          };
        }
        const totalStr = fmtPrice(booking.totalCents, booking.currency, lang);
        return {
          reply: s.beautyPayPhonePrompt(booking.bookingNumber, totalStr),
          nextState: 'BEAUTY_PAY_PHONE',
          nextMenuState: {
            stack,
            beauty: {
              pendingPaymentTxnId: beauty?.pendingPaymentTxnId,
              payTotalCents: booking.totalCents,
              payCurrency: booking.currency,
              payBookingId: booking.id,
            },
          },
          sideEffects: [],
        };
      }

      if (isDualVerticalTenant(meta) && d === '7') {
        return {
          reply: formatNumberedMenu(lang, 'FOOD_DINING', meta.businessName, meta.hostName, [
            { digit: '8', label: t(lang).optSwitchToBeauty },
          ]),
          nextState: 'MAIN_MENU',
          nextMenuState: { stack: [] },
          sideEffects: [{ type: 'SWITCH_VERTICAL', to: 'FOOD_DINING' }],
        };
      }

      return this.showMainMenu(lang, meta, beauty?.pendingPaymentTxnId);
    }

    if (currentState === 'BEAUTY_TIP_AMOUNT') {
      if (d === '0') {
        return this.showMainMenu(lang, meta, beauty?.pendingPaymentTxnId);
      }
      const n = Number.parseInt(d.replace(/\s/g, ''), 10);
      if (!Number.isFinite(n) || n < 1) {
        return {
          reply: s.beautyTipAmountInvalid,
          nextState: 'BEAUTY_TIP_AMOUNT',
          nextMenuState: { stack, beauty },
          sideEffects: [],
        };
      }
      const amountCents = n * 100;
      if (amountCents < 100) {
        return {
          reply: s.beautyTipAmountInvalid,
          nextState: 'BEAUTY_TIP_AMOUNT',
          nextMenuState: { stack, beauty },
          sideEffects: [],
        };
      }
      return {
        reply: s.beautyTipPhonePrompt,
        nextState: 'BEAUTY_TIP_PHONE',
        nextMenuState: {
          stack,
          beauty: {
            pendingPaymentTxnId: beauty?.pendingPaymentTxnId,
            tipAmountCents: amountCents,
          },
        },
        sideEffects: [],
      };
    }

    if (currentState === 'BEAUTY_TIP_PHONE') {
      if (d === '0') {
        return {
          reply: s.beautyTipAmountPrompt,
          nextState: 'BEAUTY_TIP_AMOUNT',
          nextMenuState: {
            stack,
            beauty: { pendingPaymentTxnId: beauty?.pendingPaymentTxnId },
          },
          sideEffects: [],
        };
      }
      const ac = beauty?.tipAmountCents;
      if (ac == null) {
        return this.showMainMenu(lang, meta, beauty?.pendingPaymentTxnId);
      }
      const phone = this.normalizeMsisdnTz(d);
      if (!phone) {
        return {
          reply: s.beautyTipPhoneInvalid,
          nextState: 'BEAUTY_TIP_PHONE',
          nextMenuState: { stack, beauty },
          sideEffects: [],
        };
      }
      try {
        const tipBookingId = await this.beautyBookings.findSessionBookingIdForTipLink(session.id);
        const tipRow = await this.tips.createDigitalTipFromConversation({
          sessionId: session.id,
          tenantId: session.tenantId,
          amountCents: ac,
          currency: 'TZS',
          phoneNumber: phone,
          vertical: 'BEAUTY_GROOMING',
          ...(tipBookingId ? { beautyBookingId: tipBookingId } : {}),
        });
        const pt = tipRow.paymentTxn;
        const pend = pt?.status === 'PENDING' ? pt.id : undefined;
        const tipFail = pt?.status === 'FAILED';
        return {
          reply: tipFail
            ? s.beautyPayFailed
            : `${s.beautyTipUssdSent}\n\n${s.payStatusHint}`,
          nextState: 'MAIN_MENU',
          nextMenuState: {
            stack: [],
            beauty: pend
              ? { pendingPaymentTxnId: pend }
              : beauty?.pendingPaymentTxnId
                ? { pendingPaymentTxnId: beauty.pendingPaymentTxnId }
                : {},
          },
          sideEffects: [],
        };
      } catch (e) {
        return {
          reply: httpErrorMessage(e),
          nextState: 'MAIN_MENU',
          nextMenuState: {
            stack: [],
            beauty: beauty?.pendingPaymentTxnId ? { pendingPaymentTxnId: beauty.pendingPaymentTxnId } : {},
          },
          sideEffects: [],
        };
      }
    }

    if (currentState === 'BEAUTY_PAY_PHONE') {
      if (d === '0') {
        return this.showMainMenu(lang, meta, beauty?.pendingPaymentTxnId);
      }
      const total = beauty?.payTotalCents;
      const cur = beauty?.payCurrency;
      if (total == null || total < 1 || !cur) {
        return this.showMainMenu(lang, meta, beauty?.pendingPaymentTxnId);
      }
      const b = requireBranch();
      if (!b) {
        return {
          reply: s.beautyNeedBranch,
          nextState: 'MAIN_MENU',
          nextMenuState: { stack: [] },
          sideEffects: [],
        };
      }
      const phone = this.normalizeMsisdnTz(d);
      if (!phone) {
        const booking = await this.beautyBookings.findOpenBookingSummaryForSession(session.id);
        const totalStr = booking ? fmtPrice(booking.totalCents, booking.currency, lang) : '—';
        const ref = booking?.bookingNumber ?? '—';
        return {
          reply: `${s.beautyTipPhoneInvalid}\n\n${s.beautyPayPhonePrompt(ref, totalStr)}`,
          nextState: 'BEAUTY_PAY_PHONE',
          nextMenuState: { stack, beauty },
          sideEffects: [],
        };
      }
      try {
        const txn = await this.payments.createCollectionFromConversation({
          sessionId: session.id,
          tenantId: session.tenantId,
          branchId: b,
          amountCents: total,
          currency: cur,
          phoneNumber: phone,
          ...(beauty?.payBookingId ? { beautyBookingId: beauty.payBookingId } : {}),
        });
        const pending = txn.status === 'PENDING' ? txn.id : undefined;
        const fail = txn.status === 'FAILED';
        return {
          reply: fail
            ? s.beautyPayFailed
            : `${s.beautyPayUssdSent}${pending ? `\n\n${s.payStatusHint}` : ''}`,
          nextState: 'MAIN_MENU',
          nextMenuState: {
            stack: [],
            beauty: pending
              ? { pendingPaymentTxnId: pending }
              : beauty?.pendingPaymentTxnId
                ? { pendingPaymentTxnId: beauty.pendingPaymentTxnId }
                : {},
          },
          sideEffects: [],
        };
      } catch (e) {
        return {
          reply: httpErrorMessage(e),
          nextState: 'MAIN_MENU',
          nextMenuState: {
            stack: [],
            beauty: beauty?.pendingPaymentTxnId ? { pendingPaymentTxnId: beauty.pendingPaymentTxnId } : {},
          },
          sideEffects: [],
        };
      }
    }

    if (currentState === 'BEAUTY_MENU_CATEGORIES') {
      const ids = beauty?.orderedCategoryIds ?? [];
      const n = Number.parseInt(d, 10);
      if (!Number.isFinite(n) || n < 1 || n > ids.length) {
        const cats = await this.loadCategories(session.tenantId, session.branchId);
        const { text: catText, ids: freshIds } = this.formatCategoryList(lang, cats);
        return {
          reply: catText,
          nextState: 'BEAUTY_MENU_CATEGORIES',
          nextMenuState: { stack, beauty: { orderedCategoryIds: freshIds } },
          sideEffects: [],
        };
      }
      const categoryId = ids[n - 1]!;
      const catRow = await this.prisma.beautyServiceCategory.findFirst({
        where: { id: categoryId, tenantId: session.tenantId, deletedAt: null },
      });
      const categoryName = catRow?.name ?? '—';
      const services = await this.loadServices(session.tenantId, session.branchId, categoryId);
      return {
        reply: this.formatServiceList(lang, categoryName, services).text,
        nextState: 'BEAUTY_MENU_SERVICES',
        nextMenuState: {
          stack,
          beauty: { orderedCategoryIds: ids, servicesCategoryId: categoryId },
        },
        sideEffects: [],
      };
    }

    if (currentState === 'BEAUTY_MENU_SERVICES') {
      const catId = beauty?.servicesCategoryId;
      if (!catId) {
        const cats = await this.loadCategories(session.tenantId, session.branchId);
        const { text: catText, ids } = this.formatCategoryList(lang, cats);
        return {
          reply: catText,
          nextState: 'BEAUTY_MENU_CATEGORIES',
          nextMenuState: { stack, beauty: { orderedCategoryIds: ids } },
          sideEffects: [],
        };
      }
      const catRow = await this.prisma.beautyServiceCategory.findFirst({
        where: { id: catId, tenantId: session.tenantId, deletedAt: null },
      });
      const categoryName = catRow?.name ?? '—';
      const services = await this.loadServices(session.tenantId, session.branchId, catId);
      const n = Number.parseInt(d, 10);
      if (Number.isFinite(n) && n >= 1 && n <= services.length) {
        const picked = services[n - 1]!;
        const b = requireBranch();
        if (!b) {
          return {
            reply: s.beautyNeedBranch,
            nextState: 'BEAUTY_MENU_SERVICES',
            nextMenuState: { stack, beauty },
            sideEffects: [],
          };
        }
        if (!picked.isActive) {
          const hint =
            lang === 'sw'
              ? '\n\nHuduma haipo. Chagua nyingine.'
              : '\n\nThat service is unavailable. Pick another.';
          return {
            reply: this.formatServiceList(lang, categoryName, services).text + hint,
            nextState: 'BEAUTY_MENU_SERVICES',
            nextMenuState: { stack, beauty },
            sideEffects: [],
          };
        }
        try {
          const r = await this.beautyBookings.addServiceFromConversation(
            {
              sessionId: session.id,
              tenantId: session.tenantId,
              branchId: b,
              stationId: session.beautyStationId,
              customerPhone: session.externalCustomerId,
              beautyServiceId: picked.id,
            },
            {},
          );
          const added =
            lang === 'sw'
              ? `Imeongezwa: ${picked.name}\n${r.bookingNumber}`
              : `Added: ${picked.name}\n${r.bookingNumber}`;
          return {
            reply: added,
            nextState: 'BEAUTY_MENU_SERVICES',
            nextMenuState: { stack, beauty },
            sideEffects: [],
          };
        } catch (e) {
          return {
            reply: httpErrorMessage(e),
            nextState: 'BEAUTY_MENU_SERVICES',
            nextMenuState: { stack, beauty },
            sideEffects: [],
          };
        }
      }
      const hint =
        lang === 'sw'
          ? '\n\nAndika nambari sahihi au 0 kurudi.'
          : '\n\nChoose a valid option or press 0 to go back.';
      return {
        reply: this.formatServiceList(lang, categoryName, services).text + hint,
        nextState: 'BEAUTY_MENU_SERVICES',
        nextMenuState: { stack, beauty },
        sideEffects: [],
      };
    }

    if (currentState === 'EXIT') {
      return {
        reply: s.exitThanks,
        nextState: 'EXIT',
        nextMenuState: { stack: [] },
        sideEffects: [],
      };
    }

    return this.showMainMenu(lang, meta, beauty?.pendingPaymentTxnId);
  }
}
