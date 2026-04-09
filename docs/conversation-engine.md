# Conversation engine

## Goals

- **Channel-agnostic**: `FoodDiningConversationEngine` (FOOD), `BeautyGroomingConversationEngine` (BEAUTY), and `ConversationEngineService` (fallback / legacy states) map `(session, inbound text, tenant/category metadata)` → outbound text + next state + menu stack updates. No WhatsApp/Baileys imports.
- **Tenant-aware**: primary vertical comes from enabled `TenantCategory` (prefer `FOOD_DINING`, else `BEAUTY_GROOMING`). Business name and optional host name live in `ConversationSession.metadata` JSON.
- **QR-grounded context**: `POST /api/v1/conversations/start` requires a **validated opaque QR secret** (same material as `POST /api/v1/qr/resolve`). `qrContext` and FKs on `ConversationSession` mirror resolution output; **publicRef alone is never trusted**.
- **Navigation**: numbered options; **`0` = back** using `menuState.stack` (JSON) on `ConversationSession`.
- **Languages**: **English (`en`)** and **Swahili (`sw`)** via `docs/.../conversation-i18n.ts` strings; language changes persist on the session.

## HTTP surface (`/api/v1/conversations`)

| Method | Path | Auth | Notes |
|--------|------|------|--------|
| POST | `/start` | Public | Body `{ qrToken, language?, channel?, externalCustomerId? }`. Returns **`sessionToken` only** (opaque, shown once), plus `expiresAt`, `currentState`, `language`. **No internal session id** is returned to clients. |
| POST | `/message` | Public | Body `{ sessionToken, text, newQrToken? }`. Server resolves the row via `SHA-256(sessionToken)`. Optional `newQrToken` re-resolves QR and switches context **within the same tenant**. |
| GET | `/session` | Public | Header **`X-Session-Token`** (same opaque token). Returns customer-safe session fields only (no `id`, `tenantId`, or QR FK ids). |
| POST | `/session/reset` | Public | Header **`X-Session-Token`**. Deletes all `ConversationMessage` rows for the session and resets `currentState` to `ENTRY`, `menuState` stack empty. |
| GET | `/internal/:sessionId` | JWT | Staff/support: internal **cuid** `sessionId`; requires read access to the session’s tenant. Full DTO including ids. |
| POST | `/internal/:sessionId/reset` | JWT | Staff reset by internal id (same visibility rules). |

### Abuse protection (non-test)

`POST /qr/resolve`, `POST /conversations/start`, and `POST /conversations/message` are **rate-limited** per IP (Nest Throttler). Limits are skipped when `NODE_ENV=test` so e2e stays stable.

## Session lifecycle (full)

| Topic | Behavior |
|--------|-----------|
| **Duration** | `expiresAt = createdAt + SESSION_DEFAULT_TTL_HOURS` (env, default **24h**). |
| **Storage** | Only **`SHA-256(sessionToken)`** is stored (`clientTokenHash`); the raw token is never persisted. |
| **Customer identity** | Clients keep the **opaque `sessionToken`**; they must **not** rely on internal `ConversationSession.id` in URLs or bodies. |
| **Expired session** | Any customer call that loads the session (`/message`, `GET /session`, `/session/reset`) runs an expiry check → **410 Gone** with a clear message. |
| **Activity timestamps** | Each `/message` updates `lastActivityAt` and `lastInboundAt`. |
| **Reset (customer)** | `POST /session/reset` + `X-Session-Token`: wipes transcript, sets state to `ENTRY`, empty menu stack; **does not** rotate `sessionToken` or change `expiresAt`. |
| **Reset (staff)** | `POST /internal/:sessionId/reset` + JWT: same data effect, keyed by internal id for dashboards. |
| **New QR scan (same tenant)** | Optional `newQrToken` on `/message`: validates a fresh QR secret, updates `qrContext` / branch / table / station / staff FKs, resets flow to `ENTRY`, refreshes `metadata` host name. **Rejected** if the new QR resolves to another `tenantId`. |
| **Language** | Chosen at `/start` and updated by the engine when the user completes the language menu; persisted on `ConversationSession.language` (`en` / `sw`). |

## Customer flows (implemented)

### FOOD_DINING

Main menu (implemented): **1** view menu, **2** request bill, **3** call waiter, **4** customer support, **5** change language, **6** exit, **7** rate your visit. **0** backs out of submenus.

- **View menu (1):** Loads **real** `DiningMenuCategory` / `DiningMenuItem` rows (tenant-wide + branch rows for `session.branchId`). States `FOOD_MENU_CATEGORIES` → `FOOD_MENU_ITEMS`; **0** goes back.
- **Bill (2), Waiter (3), Support (4):** When `session.branchId` is set, creates **`BillRequest`**, **`WaiterCallRequest`**, or **`DiningCustomerServiceRequest`** with `sessionId` and optional `diningTableId`, and writes **AuditLog** (`actorType: CONVERSATION_SESSION`). Without branch context (e.g. bare `BUSINESS_QR` without `branchId`), the engine returns an explicit user-facing message (scan **table** or **branch** business QR) and **does not** persist requests.
- **Rate (7):** Loads tenant **rating policy** from `TenantCategory.settings.ratings` (via `RatingsService.getPolicyForVertical`). Target options depend on `allowedTargets`: **BUSINESS** (`targetId = tenantId`), **STAFF** (requires `session.staffId`, e.g. `STAFF_QR`), **SERVICE** (pick category → menu item). Then score (`minScore`–`maxScore`) and optional required comment. Submits via `RatingsService.createFromConversation` (session-bound duplicate / update window). States: `FOOD_RATING_TARGET`, `FOOD_RATING_ITEM_CATEGORY`, `FOOD_RATING_ITEM_PICK`, `FOOD_RATING_SCORE`, `FOOD_RATING_COMMENT`.

### BEAUTY_GROOMING

Main menu (implemented): **1** view services, **2** request assistance / reception, **3** customer support, **4** change language, **5** exit, **6** rate your visit. **0** backs out.

- **View services (1):** Loads **real** `BeautyServiceCategory` / `BeautyService` rows (same tenant-wide + branch merge as food). States `BEAUTY_MENU_CATEGORIES` → `BEAUTY_MENU_SERVICES`; lists price (or “on request”), optional duration, and inactive rows as unavailable.
- **Assistance (2), Support (3):** When `session.branchId` is set, each creates an **`AssistanceRequest`** with `sessionId`, optional `beautyStationId` from `STATION_QR`, optional targeted `staffId` from `STAFF_QR`, status `PENDING`, and notes `[RECEPTION]` or `[CUSTOMER_SUPPORT]`; **AuditLog** with `actorType: CONVERSATION_SESSION`. Without branch, same style of guidance as food (station/branch QR).
- **STAFF_QR:** Session metadata includes `hostName` (staff `displayName`) so the welcome / main menu can greet with the provider name.
- **Rate (6):** Same policy source as food. Targets may include **BUSINESS**, **PROVIDER_EXPERIENCE** / **STAFF** (need `session.staffId`), **SERVICE** (category → service pick). States: `BEAUTY_RATING_TARGET`, `BEAUTY_RATING_SERVICE_CATEGORY`, `BEAUTY_RATING_SERVICE_PICK`, `BEAUTY_RATING_SCORE`, `BEAUTY_RATING_COMMENT`.

## Persistence

- `ConversationMessage` stores inbound/outbound lines for audit and analytics.
- Engine does **not** initiate PSP flows; ratings and tips use dedicated APIs / staff tools. Keep card data out of chat transcripts.

## QR lifecycle (summary)

1. **Create** — `POST /api/v1/qr` stores `tokenHash` + `publicRef`, `status=ACTIVE`; response includes **`rawToken` once**.
2. **Resolve** — `POST /api/v1/qr/resolve` with `{ token }` increments `scanCount`, sets `lastScannedAt`; returns non-secret context only.
3. **Revoke** — `POST /api/v1/qr/:id/revoke` sets `REVOKED` + `revokedAt`; further resolves fail.
4. **Rotate** — `POST /api/v1/qr/:id/rotate` replaces `tokenHash`, sets `rotatedAt`, resets `scanCount`; old secret no longer resolves.
5. **Expire** — optional `expiresAt`; resolve marks `EXPIRED` when past due.

## Related code

- `apps/api/src/modules/conversations/conversation-engine.service.ts` — fallback / legacy states; ENTRY hint by `primaryCategory`.
- `apps/api/src/modules/food-dining/food-dining-conversation.engine.ts` — FOOD_DINING DB-backed menu + operational side effects.
- `apps/api/src/modules/beauty-grooming/beauty-grooming-conversation.engine.ts` — BEAUTY_GROOMING DB-backed catalog + assistance side effects.
- `conversation-i18n.ts` (under `conversations/`) — copy for `en` / `sw`.
- `apps/api/src/modules/conversations/session.service.ts` — token hash, expiry checks.
- `apps/api/src/modules/conversations/conversations.service.ts` — orchestration + Prisma writes.
