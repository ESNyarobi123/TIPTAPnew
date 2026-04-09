import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { formatNumberedMenu, normalizeLang, t, type LangCode } from './conversation-i18n';

export type SessionBizMeta = {
  businessName: string;
  primaryCategory: 'FOOD_DINING' | 'BEAUTY_GROOMING';
  hostName?: string | null;
  /** When tenant has both verticals enabled; drives hybrid menu + switching. */
  enabledVerticals?: ('FOOD_DINING' | 'BEAUTY_GROOMING')[];
};

export function isDualVerticalTenant(meta: SessionBizMeta): boolean {
  const v = meta.enabledVerticals;
  return (
    Array.isArray(v) && v.includes('FOOD_DINING') && v.includes('BEAUTY_GROOMING')
  );
}

type MenuStack = { stack: string[] };

function parseStack(menuState: unknown): MenuStack {
  if (
    menuState &&
    typeof menuState === 'object' &&
    Array.isArray((menuState as MenuStack).stack)
  ) {
    return { stack: [...((menuState as MenuStack).stack as string[])] };
  }
  return { stack: [] };
}

export type EngineRunResult = {
  reply: string;
  nextState: string;
  nextMenuState: Prisma.InputJsonValue;
  nextLanguage?: LangCode;
};

@Injectable()
export class ConversationEngineService {
  run(
    text: string,
    currentState: string,
    menuState: unknown,
    language: string,
    meta: SessionBizMeta,
  ): EngineRunResult {
    const lang = normalizeLang(language);
    const s = t(lang);
    const d = text.trim();
    const stack = parseStack(menuState);

    const showMainMenu = (): EngineRunResult => ({
      reply: formatNumberedMenu(lang, meta.primaryCategory, meta.businessName, meta.hostName),
      nextState: 'MAIN_MENU',
      nextMenuState: { stack: [] },
    });

    if (d === '0') {
      if (stack.stack.length === 0) {
        return {
          reply: s.atRoot,
          nextState: currentState === 'ENTRY' ? 'ENTRY' : 'MAIN_MENU',
          nextMenuState: { stack: [] },
        };
      }
      const prev = stack.stack.pop()!;
      if (prev === 'MAIN_MENU') {
        return showMainMenu();
      }
      return {
        reply: s.back,
        nextState: prev,
        nextMenuState: { stack: stack.stack },
      };
    }

    if (currentState === 'ENTRY') {
      if (d === '1') {
        return showMainMenu();
      }
      const entryHint =
        meta.primaryCategory === 'BEAUTY_GROOMING'
          ? s.entryOpenBeauty(meta.businessName, meta.hostName)
          : s.entryOpenFood(meta.businessName, meta.hostName);
      return {
        reply: entryHint,
        nextState: 'ENTRY',
        nextMenuState: { stack: [] },
      };
    }

    if (currentState === 'LANGUAGE_SELECT') {
      if (d === '1') {
        return {
          reply: s.languageSet('English'),
          nextLanguage: 'en',
          nextState: 'MAIN_MENU',
          nextMenuState: { stack: [] },
        };
      }
      if (d === '2') {
        return {
          reply: s.languageSet('Kiswahili'),
          nextLanguage: 'sw',
          nextState: 'MAIN_MENU',
          nextMenuState: { stack: [] },
        };
      }
      return {
        reply: s.languageMenu,
        nextState: 'LANGUAGE_SELECT',
        nextMenuState: { stack: stack.stack },
      };
    }

    if (currentState === 'MAIN_MENU') {
      const isFood = meta.primaryCategory === 'FOOD_DINING';
      const langOpt = isFood ? '5' : '4';
      const exitOpt = isFood ? '6' : '5';

      if (d === langOpt) {
        stack.stack.push('MAIN_MENU');
        return {
          reply: s.languageMenu,
          nextState: 'LANGUAGE_SELECT',
          nextMenuState: { stack: stack.stack },
        };
      }

      if (d === exitOpt) {
        return {
          reply: s.exitThanks,
          nextState: 'EXIT',
          nextMenuState: { stack: [] },
        };
      }

      if (d === '1') {
        stack.stack.push('MAIN_MENU');
        const reply = isFood ? s.menuSoon : s.servicesSoon;
        return {
          reply,
          nextState: isFood ? 'FOOD_VIEW_MENU' : 'BEAUTY_VIEW_SERVICES',
          nextMenuState: { stack: stack.stack },
        };
      }

      if (isFood && ['2', '3', '4'].includes(d)) {
        return { reply: s.stub, nextState: 'MAIN_MENU', nextMenuState: { stack: [] } };
      }
      if (!isFood && ['2', '3'].includes(d)) {
        return { reply: s.stub, nextState: 'MAIN_MENU', nextMenuState: { stack: [] } };
      }

      return showMainMenu();
    }

    if (currentState === 'FOOD_VIEW_MENU' || currentState === 'BEAUTY_VIEW_SERVICES') {
      return showMainMenu();
    }

    if (currentState === 'EXIT') {
      return {
        reply: s.exitThanks,
        nextState: 'EXIT',
        nextMenuState: { stack: [] },
      };
    }

    return showMainMenu();
  }
}
