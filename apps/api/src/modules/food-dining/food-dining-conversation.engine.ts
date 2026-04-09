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
import { RatingsService } from '../ratings/ratings.service';
import { PaymentsService } from '../payments/payments.service';
import { TipsService } from '../tips/tips.service';
import { DiningOrdersService } from './dining-orders/dining-orders.service';

export type FoodSessionContext = {
  id: string;
  tenantId: string;
  branchId: string | null;
  diningTableId: string | null;
  staffId: string | null;
  externalCustomerId: string | null;
};

export type FoodEngineSideEffect =
  | { type: 'WAITER_CALL' }
  | { type: 'BILL_REQUEST' }
  | { type: 'DINING_SUPPORT' }
  | { type: 'SWITCH_VERTICAL'; to: 'BEAUTY_GROOMING' };

export type FoodEngineRunResult = {
  reply: string;
  nextState: string;
  nextMenuState: Prisma.InputJsonValue;
  nextLanguage?: LangCode;
  sideEffects: FoodEngineSideEffect[];
};

type FoodRatingChoice = { digit: string; kind: RatingTargetType };

type FoodRatingDraft = {
  targetType?: RatingTargetType;
  targetId?: string;
  score?: number;
  orderedCategoryIds?: string[];
  itemsCategoryId?: string;
  orderedItemIds?: string[];
};

type MenuStack = { stack: string[]; food?: FoodMenuPayload };
type FoodMenuPayload = {
  orderedCategoryIds: string[];
  itemsCategoryId?: string;
  rating?: FoodRatingDraft;
  ratingChoices?: FoodRatingChoice[];
  tipAmountCents?: number;
  payTotalCents?: number;
  payCurrency?: string;
  payOrderId?: string;
  pendingPaymentTxnId?: string;
};

function parseMenuState(menuState: unknown): MenuStack {
  if (menuState && typeof menuState === 'object') {
    const o = menuState as Record<string, unknown>;
    const stack = Array.isArray(o.stack) ? [...(o.stack as string[])] : [];
    const food = o.food && typeof o.food === 'object' ? (o.food as FoodMenuPayload) : undefined;
    return { stack, food };
  }
  return { stack: [] };
}

function fmtPrice(priceCents: number, currency: string): string {
  return `${(priceCents / 100).toFixed(2)} ${currency}`;
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
export class FoodDiningConversationEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ratings: RatingsService,
    private readonly diningOrders: DiningOrdersService,
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
    return this.prisma.diningMenuCategory.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        ...this.branchWhere(branchId),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  private async loadItems(tenantId: string, branchId: string | null, categoryId: string) {
    return this.prisma.diningMenuItem.findMany({
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
      return { text: s.foodNoCategories, ids: [] };
    }
    const lines: string[] = [s.foodCategoriesTitle, ''];
    const ids: string[] = [];
    categories.forEach((c, i) => {
      const n = i + 1;
      ids.push(c.id);
      lines.push(`${n} — ${c.name}`);
    });
    lines.push('');
    lines.push(lang === 'sw' ? '0 — Rudi menyu kuu' : '0 — Main menu');
    return { text: lines.join('\n'), ids };
  }

  private formatItemList(
    lang: LangCode,
    categoryName: string,
    items: { id: string; name: string; priceCents: number; currency: string; isAvailable: boolean }[],
  ): { text: string; ids: string[] } {
    const s = t(lang);
    if (items.length === 0) {
      return { text: s.foodNoItems, ids: [] };
    }
    const lines: string[] = [`${s.foodItemsTitle}: ${categoryName}`, ''];
    const ids: string[] = [];
    items.forEach((it, i) => {
      const price = fmtPrice(it.priceCents, it.currency);
      const avail = it.isAvailable ? '' : ` (${s.foodUnavailable})`;
      ids.push(it.id);
      lines.push(`${i + 1} — ${it.name} — ${price}${avail}`);
    });
    lines.push('');
    lines.push(lang === 'sw' ? '0 — Rudi kwa makundi' : '0 — Back to categories');
    return { text: lines.join('\n'), ids };
  }

  private foodRatingTargetMenu(
    lang: LangCode,
    session: FoodSessionContext,
    policy: ResolvedRatingPolicy,
  ): { text: string; choices: FoodRatingChoice[] } {
    const s = t(lang);
    const lines: string[] = [s.ratingTargetTitle, ''];
    const choices: FoodRatingChoice[] = [];
    let n = 1;
    if (policy.allowedTargets.includes('BUSINESS')) {
      lines.push(`${n} — ${s.ratingOptBusiness}`);
      choices.push({ digit: String(n), kind: 'BUSINESS' });
      n += 1;
    }
    if (policy.allowedTargets.includes('STAFF')) {
      lines.push(`${n} — ${s.ratingOptStaff}`);
      choices.push({ digit: String(n), kind: 'STAFF' });
      n += 1;
    }
    if (policy.allowedTargets.includes('SERVICE')) {
      lines.push(`${n} — ${s.ratingOptService}`);
      choices.push({ digit: String(n), kind: 'SERVICE' });
      n += 1;
    }
    lines.push('');
    lines.push(lang === 'sw' ? '0 — Rudi menyu kuu' : '0 — Main menu');
    return { text: lines.join('\n'), choices };
  }

  private async submitFoodRating(
    session: FoodSessionContext,
    targetType: RatingTargetType,
    targetId: string,
    score: number,
    comment: string | null,
    lang: LangCode,
  ): Promise<FoodEngineRunResult> {
    const s = t(lang);
    try {
      await this.ratings.createFromConversation(
        {
          tenantId: session.tenantId,
          branchId: session.branchId,
          sessionId: session.id,
          vertical: 'FOOD_DINING',
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
  ): FoodEngineRunResult {
    const dual = isDualVerticalTenant(meta);
    const extras: { digit: string; label: string }[] = [];
    if (dual) {
      extras.push({ digit: '8', label: t(lang).optSwitchToBeauty });
    }
    extras.push({ digit: dual ? '9' : '8', label: t(lang).optTipStaff });
    extras.push({ digit: dual ? '10' : '9', label: t(lang).optPayWithMobile });
    let reply = formatNumberedMenu(lang, 'FOOD_DINING', meta.businessName, meta.hostName, extras);
    if (pendingPaymentTxnId) {
      reply += `\n\n${t(lang).payStatusHint}`;
    }
    return {
      reply,
      nextState: 'MAIN_MENU',
      nextMenuState: pendingPaymentTxnId
        ? { stack: [], food: { pendingPaymentTxnId } }
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
    session: FoodSessionContext,
    opts?: { ratingPolicy?: ResolvedRatingPolicy },
  ): Promise<FoodEngineRunResult> {
    const lang = normalizeLang(language);
    const s = t(lang);
    const d = text.trim();
    const parsed = parseMenuState(menuState);
    const stack = parsed.stack;
    const food = parsed.food;
    const ratingPolicy = opts?.ratingPolicy ?? DEFAULT_RATING_POLICY;

    const requireBranch = (): string | null => {
      return session.branchId;
    };

    if ((d === 'P' || d === 'p') && food?.pendingPaymentTxnId) {
      try {
        const refreshed = await this.payments.refreshTransactionStatusFromSession(
          session.id,
          food.pendingPaymentTxnId,
        );
        const stillPending =
          refreshed.status !== 'COMPLETED' && refreshed.status !== 'FAILED'
            ? food.pendingPaymentTxnId
            : undefined;
        let msg: string;
        if (refreshed.status === 'COMPLETED') {
          msg = s.foodPayCompleted;
        } else if (refreshed.status === 'FAILED') {
          msg = s.foodPayFailed;
        } else {
          msg = s.foodPayStillPending;
        }
        return {
          reply: msg,
          nextState: 'MAIN_MENU',
          nextMenuState: {
            stack: [],
            food: stillPending ? { pendingPaymentTxnId: stillPending } : {},
          },
          sideEffects: [],
        };
      } catch (e) {
        return {
          reply: httpErrorMessage(e),
          nextState: 'MAIN_MENU',
          nextMenuState: {
            stack: [],
            food: { pendingPaymentTxnId: food.pendingPaymentTxnId },
          },
          sideEffects: [],
        };
      }
    }

    if (d === '0') {
      if (currentState === 'FOOD_RATING_ITEM_PICK') {
        const catId = food?.rating?.itemsCategoryId;
        if (!catId) {
          return this.showMainMenu(lang, meta, food?.pendingPaymentTxnId);
        }
        const cats = await this.loadCategories(session.tenantId, session.branchId);
        const { text: catText, ids } = this.formatCategoryList(lang, cats);
        return {
          reply: catText,
          nextState: 'FOOD_RATING_ITEM_CATEGORY',
          nextMenuState: {
            stack,
            food: {
              orderedCategoryIds: food?.orderedCategoryIds ?? [],
              itemsCategoryId: food?.itemsCategoryId,
              rating: { ...food?.rating, orderedCategoryIds: ids, itemsCategoryId: undefined, orderedItemIds: undefined },
              ratingChoices: food?.ratingChoices,
            },
          },
          sideEffects: [],
        };
      }
      if (currentState === 'FOOD_RATING_ITEM_CATEGORY') {
        const { text: rtext, choices } = this.foodRatingTargetMenu(lang, session, ratingPolicy);
        return {
          reply: rtext,
          nextState: 'FOOD_RATING_TARGET',
          nextMenuState: { stack, food: { orderedCategoryIds: food?.orderedCategoryIds ?? [], ratingChoices: choices } },
          sideEffects: [],
        };
      }
      if (currentState === 'FOOD_RATING_SCORE' || currentState === 'FOOD_RATING_COMMENT') {
        const { text: rtext, choices } = this.foodRatingTargetMenu(lang, session, ratingPolicy);
        return {
          reply: rtext,
          nextState: 'FOOD_RATING_TARGET',
          nextMenuState: { stack, food: { orderedCategoryIds: food?.orderedCategoryIds ?? [], ratingChoices: choices } },
          sideEffects: [],
        };
      }
      if (currentState === 'FOOD_RATING_TARGET') {
        return this.showMainMenu(lang, meta, food?.pendingPaymentTxnId);
      }
      if (currentState === 'FOOD_MENU_ITEMS') {
        const cats = await this.loadCategories(session.tenantId, session.branchId);
        const { text: catText, ids } = this.formatCategoryList(lang, cats);
        return {
          reply: catText,
          nextState: 'FOOD_MENU_CATEGORIES',
          nextMenuState: { stack, food: { orderedCategoryIds: ids } },
          sideEffects: [],
        };
      }
      if (currentState === 'FOOD_MENU_CATEGORIES') {
        return this.showMainMenu(lang, meta, food?.pendingPaymentTxnId);
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
        return this.showMainMenu(lang, meta, food?.pendingPaymentTxnId);
      }
      return {
        reply: s.back,
        nextState: prev,
        nextMenuState: { stack, food },
        sideEffects: [],
      };
    }

    if (currentState === 'ENTRY') {
      if (d === '1') {
        return this.showMainMenu(lang, meta, food?.pendingPaymentTxnId);
      }
      return {
        reply: s.entryOpenFood(meta.businessName, meta.hostName),
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
          nextMenuState: { stack: [] },
          sideEffects: [],
        };
      }
      if (d === '2') {
        return {
          reply: s.languageSet('Kiswahili'),
          nextLanguage: 'sw',
          nextState: 'MAIN_MENU',
          nextMenuState: { stack: [] },
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

    if (currentState === 'FOOD_RATING_TARGET') {
      const choices = food?.ratingChoices ?? [];
      const hit = choices.find((c) => c.digit === d);
      if (!hit) {
        const { text: rtext, choices: ch } = this.foodRatingTargetMenu(lang, session, ratingPolicy);
        return {
          reply: rtext,
          nextState: 'FOOD_RATING_TARGET',
          nextMenuState: { stack, food: { ...food, orderedCategoryIds: food?.orderedCategoryIds ?? [], ratingChoices: ch } },
          sideEffects: [],
        };
      }
      if (hit.kind === 'BUSINESS') {
        return {
          reply: s.ratingScorePrompt(ratingPolicy.minScore, ratingPolicy.maxScore),
          nextState: 'FOOD_RATING_SCORE',
          nextMenuState: {
            stack,
            food: {
              orderedCategoryIds: food?.orderedCategoryIds ?? [],
              itemsCategoryId: food?.itemsCategoryId,
              rating: { targetType: 'BUSINESS', targetId: session.tenantId },
              ratingChoices: choices,
            },
          },
          sideEffects: [],
        };
      }
      if (hit.kind === 'STAFF') {
        if (!session.staffId) {
          return {
            reply: s.ratingNoStaff,
            nextState: 'FOOD_RATING_TARGET',
            nextMenuState: { stack, food: { ...food, ratingChoices: choices } },
            sideEffects: [],
          };
        }
        return {
          reply: s.ratingScorePrompt(ratingPolicy.minScore, ratingPolicy.maxScore),
          nextState: 'FOOD_RATING_SCORE',
          nextMenuState: {
            stack,
            food: {
              orderedCategoryIds: food?.orderedCategoryIds ?? [],
              itemsCategoryId: food?.itemsCategoryId,
              rating: { targetType: 'STAFF', targetId: session.staffId },
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
        nextState: 'FOOD_RATING_ITEM_CATEGORY',
        nextMenuState: {
          stack,
          food: {
            orderedCategoryIds: food?.orderedCategoryIds ?? [],
            rating: { ...food?.rating, orderedCategoryIds: ids },
            ratingChoices: choices,
          },
        },
        sideEffects: [],
      };
    }

    if (currentState === 'FOOD_RATING_ITEM_CATEGORY') {
      const ids = food?.rating?.orderedCategoryIds ?? [];
      const n = Number.parseInt(d, 10);
      if (!Number.isFinite(n) || n < 1 || n > ids.length) {
        const cats = await this.loadCategories(session.tenantId, session.branchId);
        const { text: catText, ids: freshIds } = this.formatCategoryList(lang, cats);
        return {
          reply: catText,
          nextState: 'FOOD_RATING_ITEM_CATEGORY',
          nextMenuState: {
            stack,
            food: {
              ...food,
              rating: { ...food?.rating, orderedCategoryIds: freshIds },
            },
          },
          sideEffects: [],
        };
      }
      const categoryId = ids[n - 1]!;
      const catRow = await this.prisma.diningMenuCategory.findFirst({
        where: { id: categoryId, tenantId: session.tenantId, deletedAt: null },
      });
      const categoryName = catRow?.name ?? '—';
      const items = await this.loadItems(session.tenantId, session.branchId, categoryId);
      const { text: itemText, ids: itemIds } = this.formatItemList(lang, categoryName, items);
      return {
        reply: itemText,
        nextState: 'FOOD_RATING_ITEM_PICK',
        nextMenuState: {
          stack,
          food: {
            ...food,
            rating: {
              ...food?.rating,
              itemsCategoryId: categoryId,
              orderedItemIds: itemIds,
            },
          },
        },
        sideEffects: [],
      };
    }

    if (currentState === 'FOOD_RATING_ITEM_PICK') {
      const ids = food?.rating?.orderedItemIds ?? [];
      const n = Number.parseInt(d, 10);
      if (!Number.isFinite(n) || n < 1 || n > ids.length) {
        const catId = food?.rating?.itemsCategoryId;
        if (!catId) {
          const { text: rtext, choices } = this.foodRatingTargetMenu(lang, session, ratingPolicy);
          return {
            reply: rtext,
            nextState: 'FOOD_RATING_TARGET',
            nextMenuState: { stack, food: { ratingChoices: choices } },
            sideEffects: [],
          };
        }
        const catRow = await this.prisma.diningMenuCategory.findFirst({
          where: { id: catId, tenantId: session.tenantId, deletedAt: null },
        });
        const categoryName = catRow?.name ?? '—';
        const items = await this.loadItems(session.tenantId, session.branchId, catId);
        const { text: itemText, ids: itemIds } = this.formatItemList(lang, categoryName, items);
        const hint =
          lang === 'sw'
            ? '\n\nAndika nambari sahihi au 0 kurudi.'
            : '\n\nChoose a valid option or press 0 to go back.';
        return {
          reply: itemText + hint,
          nextState: 'FOOD_RATING_ITEM_PICK',
          nextMenuState: {
            stack,
            food: { ...food, rating: { ...food?.rating, orderedItemIds: itemIds } },
          },
          sideEffects: [],
        };
      }
      const itemId = ids[n - 1]!;
      return {
        reply: s.ratingScorePrompt(ratingPolicy.minScore, ratingPolicy.maxScore),
        nextState: 'FOOD_RATING_SCORE',
        nextMenuState: {
          stack,
          food: {
            ...food,
            rating: { targetType: 'SERVICE', targetId: itemId },
          },
        },
        sideEffects: [],
      };
    }

    if (currentState === 'FOOD_RATING_SCORE') {
      const rt = food?.rating?.targetType;
      const tid = food?.rating?.targetId;
      if (!rt || !tid) {
        const { text: rtext, choices } = this.foodRatingTargetMenu(lang, session, ratingPolicy);
        return {
          reply: rtext,
          nextState: 'FOOD_RATING_TARGET',
          nextMenuState: { stack, food: { ratingChoices: choices } },
          sideEffects: [],
        };
      }
      const sc = Number.parseInt(d, 10);
      if (!Number.isFinite(sc) || sc < ratingPolicy.minScore || sc > ratingPolicy.maxScore) {
        return {
          reply: s.ratingScorePrompt(ratingPolicy.minScore, ratingPolicy.maxScore),
          nextState: 'FOOD_RATING_SCORE',
          nextMenuState: { stack, food },
          sideEffects: [],
        };
      }
      if (ratingPolicy.commentRequired) {
        return {
          reply: `${s.ratingCommentRequired}\n${s.ratingCommentPrompt}`,
          nextState: 'FOOD_RATING_COMMENT',
          nextMenuState: {
            stack,
            food: { ...food, rating: { ...food?.rating, score: sc } },
          },
          sideEffects: [],
        };
      }
      return this.submitFoodRating(session, rt, tid, sc, null, lang);
    }

    if (currentState === 'FOOD_RATING_COMMENT') {
      const rt = food?.rating?.targetType;
      const tid = food?.rating?.targetId;
      const sc = food?.rating?.score;
      if (!rt || !tid || sc == null) {
        const { text: rtext, choices } = this.foodRatingTargetMenu(lang, session, ratingPolicy);
        return {
          reply: rtext,
          nextState: 'FOOD_RATING_TARGET',
          nextMenuState: { stack, food: { ratingChoices: choices } },
          sideEffects: [],
        };
      }
      if (d === '0' || !d.trim()) {
        return {
          reply: `${s.ratingCommentRequired}\n${s.ratingCommentPrompt}`,
          nextState: 'FOOD_RATING_COMMENT',
          nextMenuState: { stack, food },
          sideEffects: [],
        };
      }
      return this.submitFoodRating(session, rt, tid, sc, d.trim(), lang);
    }

    if (currentState === 'MAIN_MENU') {
      const langOpt = '5';
      const exitOpt = '6';
      const rateOpt = '7';

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
        const { text: rtext, choices } = this.foodRatingTargetMenu(lang, session, ratingPolicy);
        return {
          reply: rtext,
          nextState: 'FOOD_RATING_TARGET',
          nextMenuState: { stack, food: { orderedCategoryIds: [], ratingChoices: choices } },
          sideEffects: [],
        };
      }

      if (d === '1') {
        stack.push('MAIN_MENU');
        const cats = await this.loadCategories(session.tenantId, session.branchId);
        const { text: catText, ids } = this.formatCategoryList(lang, cats);
        return {
          reply: catText,
          nextState: 'FOOD_MENU_CATEGORIES',
          nextMenuState: { stack, food: { orderedCategoryIds: ids } },
          sideEffects: [],
        };
      }

      if (d === '2') {
        const b = requireBranch();
        if (!b) {
          return {
            reply: s.foodNeedBranch,
            nextState: 'MAIN_MENU',
            nextMenuState: { stack: [] },
            sideEffects: [],
          };
        }
        return {
          reply: s.foodBillOk,
          nextState: 'MAIN_MENU',
          nextMenuState: { stack: [] },
          sideEffects: [{ type: 'BILL_REQUEST' }],
        };
      }

      if (d === '3') {
        const b = requireBranch();
        if (!b) {
          return {
            reply: s.foodNeedBranch,
            nextState: 'MAIN_MENU',
            nextMenuState: { stack: [] },
            sideEffects: [],
          };
        }
        return {
          reply: s.foodWaiterOk,
          nextState: 'MAIN_MENU',
          nextMenuState: { stack: [] },
          sideEffects: [{ type: 'WAITER_CALL' }],
        };
      }

      if (d === '4') {
        const b = requireBranch();
        if (!b) {
          return {
            reply: s.foodNeedBranch,
            nextState: 'MAIN_MENU',
            nextMenuState: { stack: [] },
            sideEffects: [],
          };
        }
        return {
          reply: s.foodSupportOk,
          nextState: 'MAIN_MENU',
          nextMenuState: { stack: [] },
          sideEffects: [{ type: 'DINING_SUPPORT' }],
        };
      }

      const tipD = isDualVerticalTenant(meta) ? '9' : '8';
      const payD = isDualVerticalTenant(meta) ? '10' : '9';

      if (d === tipD) {
        if (!session.staffId) {
          return {
            reply: s.foodTipNeedStaffQr,
            nextState: 'MAIN_MENU',
            nextMenuState: {
              stack: [],
              food: food?.pendingPaymentTxnId ? { pendingPaymentTxnId: food.pendingPaymentTxnId } : {},
            },
            sideEffects: [],
          };
        }
        return {
          reply: s.foodTipAmountPrompt,
          nextState: 'FOOD_TIP_AMOUNT',
          nextMenuState: {
            stack,
            food: {
              pendingPaymentTxnId: food?.pendingPaymentTxnId,
            },
          },
          sideEffects: [],
        };
      }

      if (d === payD) {
        const b = requireBranch();
        if (!b) {
          return {
            reply: s.foodNeedBranch,
            nextState: 'MAIN_MENU',
            nextMenuState: { stack: [] },
            sideEffects: [],
          };
        }
        const order = await this.diningOrders.findOpenOrderSummaryForSession(session.id);
        if (!order || order.totalCents < 1) {
          return {
            reply: s.foodPayNoOrder,
            nextState: 'MAIN_MENU',
            nextMenuState: {
              stack: [],
              food: food?.pendingPaymentTxnId ? { pendingPaymentTxnId: food.pendingPaymentTxnId } : {},
            },
            sideEffects: [],
          };
        }
        const totalStr = fmtPrice(order.totalCents, order.currency);
        return {
          reply: s.foodPayPhonePrompt(order.orderNumber, totalStr),
          nextState: 'FOOD_PAY_PHONE',
          nextMenuState: {
            stack,
            food: {
              pendingPaymentTxnId: food?.pendingPaymentTxnId,
              payTotalCents: order.totalCents,
              payCurrency: order.currency,
              payOrderId: order.id,
            },
          },
          sideEffects: [],
        };
      }

      if (isDualVerticalTenant(meta) && d === '8') {
        return {
          reply: formatNumberedMenu(lang, 'BEAUTY_GROOMING', meta.businessName, meta.hostName, [
            { digit: '7', label: t(lang).optSwitchToFood },
          ]),
          nextState: 'MAIN_MENU',
          nextMenuState: { stack: [] },
          sideEffects: [{ type: 'SWITCH_VERTICAL', to: 'BEAUTY_GROOMING' }],
        };
      }

      return this.showMainMenu(lang, meta, food?.pendingPaymentTxnId);
    }

    if (currentState === 'FOOD_TIP_AMOUNT') {
      if (d === '0') {
        return this.showMainMenu(lang, meta, food?.pendingPaymentTxnId);
      }
      const n = Number.parseInt(d.replace(/\s/g, ''), 10);
      if (!Number.isFinite(n) || n < 1) {
        return {
          reply: s.foodTipAmountInvalid,
          nextState: 'FOOD_TIP_AMOUNT',
          nextMenuState: { stack, food },
          sideEffects: [],
        };
      }
      const amountCents = n * 100;
      if (amountCents < 100) {
        return {
          reply: s.foodTipAmountInvalid,
          nextState: 'FOOD_TIP_AMOUNT',
          nextMenuState: { stack, food },
          sideEffects: [],
        };
      }
      return {
        reply: s.foodTipPhonePrompt,
        nextState: 'FOOD_TIP_PHONE',
        nextMenuState: {
          stack,
          food: {
            pendingPaymentTxnId: food?.pendingPaymentTxnId,
            tipAmountCents: amountCents,
          },
        },
        sideEffects: [],
      };
    }

    if (currentState === 'FOOD_TIP_PHONE') {
      if (d === '0') {
        return {
          reply: s.foodTipAmountPrompt,
          nextState: 'FOOD_TIP_AMOUNT',
          nextMenuState: {
            stack,
            food: { pendingPaymentTxnId: food?.pendingPaymentTxnId },
          },
          sideEffects: [],
        };
      }
      const ac = food?.tipAmountCents;
      if (ac == null) {
        return this.showMainMenu(lang, meta, food?.pendingPaymentTxnId);
      }
      const phone = this.normalizeMsisdnTz(d);
      if (!phone) {
        return {
          reply: s.foodTipPhoneInvalid,
          nextState: 'FOOD_TIP_PHONE',
          nextMenuState: { stack, food },
          sideEffects: [],
        };
      }
      try {
        const openOrder = await this.diningOrders.findOpenOrderSummaryForSession(session.id);
        const tipRow = await this.tips.createDigitalTipFromConversation({
          sessionId: session.id,
          tenantId: session.tenantId,
          amountCents: ac,
          currency: 'TZS',
          phoneNumber: phone,
          vertical: 'FOOD_DINING',
          ...(openOrder ? { diningOrderId: openOrder.id } : {}),
        });
        const pt = tipRow.paymentTxn;
        const pend = pt?.status === 'PENDING' ? pt.id : undefined;
        const tipFail = pt?.status === 'FAILED';
        return {
          reply: tipFail
            ? s.foodPayFailed
            : `${s.foodTipUssdSent}\n\n${s.payStatusHint}`,
          nextState: 'MAIN_MENU',
          nextMenuState: {
            stack: [],
            food: pend
              ? { pendingPaymentTxnId: pend }
              : food?.pendingPaymentTxnId
                ? { pendingPaymentTxnId: food.pendingPaymentTxnId }
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
            food: food?.pendingPaymentTxnId ? { pendingPaymentTxnId: food.pendingPaymentTxnId } : {},
          },
          sideEffects: [],
        };
      }
    }

    if (currentState === 'FOOD_PAY_PHONE') {
      if (d === '0') {
        return this.showMainMenu(lang, meta, food?.pendingPaymentTxnId);
      }
      const total = food?.payTotalCents;
      const cur = food?.payCurrency;
      if (total == null || total < 1 || !cur) {
        return this.showMainMenu(lang, meta, food?.pendingPaymentTxnId);
      }
      const b = requireBranch();
      if (!b) {
        return {
          reply: s.foodNeedBranch,
          nextState: 'MAIN_MENU',
          nextMenuState: { stack: [] },
          sideEffects: [],
        };
      }
      const phone = this.normalizeMsisdnTz(d);
      if (!phone) {
        const order = await this.diningOrders.findOpenOrderSummaryForSession(session.id);
        const totalStr = order ? fmtPrice(order.totalCents, order.currency) : '—';
        const orderNo = order?.orderNumber ?? '—';
        return {
          reply: `${s.foodTipPhoneInvalid}\n\n${s.foodPayPhonePrompt(orderNo, totalStr)}`,
          nextState: 'FOOD_PAY_PHONE',
          nextMenuState: { stack, food },
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
          ...(food?.payOrderId ? { diningOrderId: food.payOrderId } : {}),
        });
        const pending = txn.status === 'PENDING' ? txn.id : undefined;
        const fail = txn.status === 'FAILED';
        return {
          reply: fail
            ? s.foodPayFailed
            : `${s.foodPayUssdSent}${pending ? `\n\n${s.payStatusHint}` : ''}`,
          nextState: 'MAIN_MENU',
          nextMenuState: {
            stack: [],
            food: pending
              ? { pendingPaymentTxnId: pending }
              : food?.pendingPaymentTxnId
                ? { pendingPaymentTxnId: food.pendingPaymentTxnId }
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
            food: food?.pendingPaymentTxnId ? { pendingPaymentTxnId: food.pendingPaymentTxnId } : {},
          },
          sideEffects: [],
        };
      }
    }

    if (currentState === 'FOOD_MENU_CATEGORIES') {
      const ids = food?.orderedCategoryIds ?? [];
      const n = Number.parseInt(d, 10);
      if (!Number.isFinite(n) || n < 1 || n > ids.length) {
        const cats = await this.loadCategories(session.tenantId, session.branchId);
        const { text: catText, ids: freshIds } = this.formatCategoryList(lang, cats);
        return {
          reply: catText,
          nextState: 'FOOD_MENU_CATEGORIES',
          nextMenuState: { stack, food: { orderedCategoryIds: freshIds } },
          sideEffects: [],
        };
      }
      const categoryId = ids[n - 1]!;
      const catRow = await this.prisma.diningMenuCategory.findFirst({
        where: { id: categoryId, tenantId: session.tenantId, deletedAt: null },
      });
      const categoryName = catRow?.name ?? '—';
      const items = await this.loadItems(session.tenantId, session.branchId, categoryId);
      return {
        reply: this.formatItemList(lang, categoryName, items).text,
        nextState: 'FOOD_MENU_ITEMS',
        nextMenuState: {
          stack,
          food: { orderedCategoryIds: ids, itemsCategoryId: categoryId },
        },
        sideEffects: [],
      };
    }

    if (currentState === 'FOOD_MENU_ITEMS') {
      const catId = food?.itemsCategoryId;
      if (!catId) {
        const cats = await this.loadCategories(session.tenantId, session.branchId);
        const { text: catText, ids } = this.formatCategoryList(lang, cats);
        return {
          reply: catText,
          nextState: 'FOOD_MENU_CATEGORIES',
          nextMenuState: { stack, food: { orderedCategoryIds: ids } },
          sideEffects: [],
        };
      }
      const catRow = await this.prisma.diningMenuCategory.findFirst({
        where: { id: catId, tenantId: session.tenantId, deletedAt: null },
      });
      const categoryName = catRow?.name ?? '—';
      const items = await this.loadItems(session.tenantId, session.branchId, catId);
      const n = Number.parseInt(d, 10);
      if (Number.isFinite(n) && n >= 1 && n <= items.length) {
        const picked = items[n - 1]!;
        const b = requireBranch();
        if (!b) {
          return {
            reply: s.foodNeedBranch,
            nextState: 'FOOD_MENU_ITEMS',
            nextMenuState: { stack, food },
            sideEffects: [],
          };
        }
        if (!picked.isAvailable) {
          const hint =
            lang === 'sw'
              ? '\n\nBidhaa haipo. Chagua nyingine.'
              : '\n\nThat item is unavailable. Pick another.';
          return {
            reply: this.formatItemList(lang, categoryName, items).text + hint,
            nextState: 'FOOD_MENU_ITEMS',
            nextMenuState: { stack, food },
            sideEffects: [],
          };
        }
        try {
          const r = await this.diningOrders.addLineFromConversation(
            {
              sessionId: session.id,
              tenantId: session.tenantId,
              branchId: b,
              diningTableId: session.diningTableId,
              customerPhone: session.externalCustomerId,
              menuItemId: picked.id,
              quantity: 1,
            },
            {},
          );
          const added =
            lang === 'sw'
              ? `Imeongezwa kwenye order: ${picked.name}\n${r.orderNumber}`
              : `Added to your order: ${picked.name}\n${r.orderNumber}`;
          return {
            reply: added,
            nextState: 'FOOD_MENU_ITEMS',
            nextMenuState: { stack, food },
            sideEffects: [],
          };
        } catch (e) {
          return {
            reply: httpErrorMessage(e),
            nextState: 'FOOD_MENU_ITEMS',
            nextMenuState: { stack, food },
            sideEffects: [],
          };
        }
      }
      const hint =
        lang === 'sw'
          ? '\n\nAndika nambari sahihi au 0 kurudi.'
          : '\n\nChoose a valid option or press 0 to go back.';
      return {
        reply: this.formatItemList(lang, categoryName, items).text + hint,
        nextState: 'FOOD_MENU_ITEMS',
        nextMenuState: { stack, food },
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

    return this.showMainMenu(lang, meta, food?.pendingPaymentTxnId);
  }
}
