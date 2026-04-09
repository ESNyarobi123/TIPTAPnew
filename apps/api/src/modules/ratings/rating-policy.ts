import type { BusinessCategory, RatingTargetType } from '@prisma/client';

export type RatingPolicyJson = {
  allowedTargets?: RatingTargetType[];
  minScore?: number;
  maxScore?: number;
  commentRequired?: boolean;
  /** Minutes after create during which PATCH is allowed (default 60). */
  updateWindowMinutes?: number;
};

/** Resolved tenant/category policy used by API and conversation engines. */
export type ResolvedRatingPolicy = Required<
  Pick<RatingPolicyJson, 'allowedTargets' | 'minScore' | 'maxScore' | 'commentRequired' | 'updateWindowMinutes'>
>;

export const DEFAULT_RATING_POLICY: ResolvedRatingPolicy = {
  allowedTargets: ['BUSINESS', 'STAFF', 'SERVICE', 'PROVIDER_EXPERIENCE'],
  minScore: 1,
  maxScore: 5,
  commentRequired: false,
  updateWindowMinutes: 60,
};

export function parseRatingPolicy(settings: unknown, vertical: BusinessCategory): ResolvedRatingPolicy {
  const base: ResolvedRatingPolicy = { ...DEFAULT_RATING_POLICY };
  if (!settings || typeof settings !== 'object') {
    return base;
  }
  const s = settings as Record<string, unknown>;
  const raw = s.ratings ?? s.ratingPolicy;
  if (!raw || typeof raw !== 'object') {
    return base;
  }
  const r = raw as RatingPolicyJson;
  if (Array.isArray(r.allowedTargets) && r.allowedTargets.length > 0) {
    base.allowedTargets = r.allowedTargets;
  }
  if (typeof r.minScore === 'number') {
    base.minScore = r.minScore;
  }
  if (typeof r.maxScore === 'number') {
    base.maxScore = r.maxScore;
  }
  if (typeof r.commentRequired === 'boolean') {
    base.commentRequired = r.commentRequired;
  }
  if (typeof r.updateWindowMinutes === 'number') {
    base.updateWindowMinutes = r.updateWindowMinutes;
  }
  void vertical;
  return base;
}
