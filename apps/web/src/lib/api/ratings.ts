import { apiFetch } from './client';
import { toQueryString } from './query';

export type RatingTargetTypeFilter = 'BUSINESS' | 'STAFF' | 'SERVICE' | 'PROVIDER_EXPERIENCE';

export function listRatings(
  token: string,
  params: {
    tenantId: string;
    sessionId?: string;
    targetType?: RatingTargetTypeFilter;
  },
) {
  return apiFetch<unknown[]>(
    `/ratings${toQueryString({
      tenantId: params.tenantId,
      sessionId: params.sessionId,
      targetType: params.targetType,
    })}`,
    { token },
  );
}
