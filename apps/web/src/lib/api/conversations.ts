import { apiFetch } from './client';
import { toQueryString } from './query';

export function listConversationSessions(
  token: string,
  q: { tenantId?: string; page?: number; pageSize?: number },
) {
  return apiFetch<unknown>(`/conversations/internal${toQueryString(q)}`, { token });
}

export function getConversationSession(token: string, sessionId: string) {
  return apiFetch<unknown>(`/conversations/internal/${encodeURIComponent(sessionId)}`, { token });
}

export function getConversationMessages(token: string, sessionId: string) {
  return apiFetch<unknown>(`/conversations/internal/${encodeURIComponent(sessionId)}/messages`, { token });
}
