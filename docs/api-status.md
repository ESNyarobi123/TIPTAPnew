# API implementation status

Last updated: **Menu & catalog images** (multipart **upload** for restaurant menu + salon services; static files under `/api/v1/files/...`). Phase 11 scheduling rules unchanged.

Legend: ✅ done · 🔄 partial · ⬜ not started

## Infrastructure

| Item | Status |
|------|--------|
| Monorepo (pnpm + turbo) | ✅ |
| Local image storage (`uploads/` → **`GET /api/v1/files/...`**, public) | ✅ |
| Global JWT guard + `@Public()` | ✅ |
| `/api/v1` prefix, health/ready | ✅ |
| Prisma schema + migrations (through Phase 10: `Branch.operatingHours`; Phase 11 is app-layer scheduling rules) | ✅ |
| E2E: real PostgreSQL + truncate (`test/setup-e2e-env.ts`) | ✅ |

## AUTH (`/api/v1/auth`)

| Method | Path | Status |
|--------|------|--------|
| POST | `/register` | ✅ (SUPER_ADMIN bootstrap gated: non-production or `ALLOW_BOOTSTRAP_SUPER_ADMIN`) |
| POST | `/login` | ✅ |
| POST | `/refresh` | ✅ rotation + **reuse detection** (revoked token reuse revokes all refresh tokens for user) |
| POST | `/logout` | ✅ |
| POST | `/logout-all` | ✅ |
| GET | `/me` | ✅ |

## Users (`/api/v1/users`)

| Method | Path | Status |
|--------|------|--------|
| GET | `/:id` | ✅ (self or SUPER_ADMIN) |
| PATCH | `/:id` | ✅ (profile fields) |

## Tenants (`/api/v1/tenants`)

| Method | Path | Status |
|--------|------|--------|
| POST | `/` | ✅ SUPER_ADMIN |
| GET | `/` | ✅ scoped list |
| GET | `/:id` | ✅ |
| PATCH | `/:id` | ✅ SUPER_ADMIN or TENANT_OWNER |
| GET | `/:id/categories` | ✅ |
| POST | `/:id/categories` | ✅ upsert |
| PATCH | `/:id/categories/:category` | ✅ |
| GET | `/:tenantId/branches` | ✅ tenant-scoped branch list |
| POST | `/:tenantId/branches` | ✅ create branch under tenant |

## Branches (`/api/v1/branches`)

| Method | Path | Status |
|--------|------|--------|
| GET | `/:id` | ✅ includes `operatingHours` when set |
| PATCH | `/:id` | ✅ optional `operatingHours` (mon..sun → `{ open, close }` HH:mm); **`null` clears** |

*(Collection list/create moved to `/tenants/:tenantId/branches` — create accepts `operatingHours` too.)*

## Public — branch card (`/api/v1/public/branches`)

| Method | Path | Status |
|--------|------|--------|
| GET | `/public/branches/:id` | ✅ **public**, rate-limited; name, address, city, country, phone, timezone, `operatingHours` (no tenant secrets) |

## Categories (`/api/v1/categories`)

| Method | Path | Status |
|--------|------|--------|
| GET | `/` | ✅ platform enum list (JWT) |

## Staff (`/api/v1/staff`)

| Method | Path | Status |
|--------|------|--------|
| POST | `/` | ✅ |
| GET | `/` | ✅ `?tenantId=` required |
| GET | `/:id` | ✅ |
| PATCH | `/:id` | ✅ |
| POST | `/:id/deactivate` | ✅ |
| POST | `/:id/assignments` | ✅ |
| GET | `/:id/assignments` | ✅ |
| PATCH | `/:id/assignments/:assignmentId` | ✅ |

## Provider registry (`/api/v1/provider-registry`)

| Method | Path | Status |
|--------|------|--------|
| POST | `/` | ✅ SUPER_ADMIN, TENANT_OWNER |
| GET | `/:id` | ✅ internal (tenant-linked owner / super) |
| GET | `/:id/public` | ✅ public DTO (no internal fields) |
| PATCH | `/:id` | ✅ SUPER_ADMIN, TENANT_OWNER |

## QR (`/api/v1/qr`)

| Method | Path | Status |
|--------|------|--------|
| POST | `/` | ✅ create (`rawToken` once); body includes `tenantId` |
| POST | `/resolve` | ✅ **public** + rate limit; body `{ token }` — opaque secret only |
| GET | `/` | ✅ list `?tenantId=` |
| GET | `/:id` | ✅ |
| POST | `/:id/revoke` | ✅ |
| POST | `/:id/rotate` | ✅ new `rawToken`; old secret fails resolve |

## QR (tenant-scoped collection)

| Method | Path | Status |
|--------|------|--------|
| POST | `/tenants/:tenantId/qr` | ✅ create (no `tenantId` in body) |
| GET | `/tenants/:tenantId/qr` | ✅ list for tenant |

## Conversations (`/api/v1/conversations`)

| Method | Path | Status |
|--------|------|--------|
| POST | `/start` | ✅ public + rate limit; returns **opaque `sessionToken` only** (no internal id) |
| POST | `/message` | ✅ public + rate limit; body `{ sessionToken, text, newQrToken? }` |
| GET | `/session` | ✅ customer; header `X-Session-Token` |
| POST | `/session/reset` | ✅ customer; header `X-Session-Token` |
| GET | `/internal/:sessionId` | ✅ staff JWT + tenant read |
| POST | `/internal/:sessionId/reset` | ✅ staff JWT + tenant read |

## Ratings (`/api/v1/ratings`)

JWT + `RolesGuard`. Session-scoped duplicate rule: same `(sessionId, targetType, targetId)` may be updated within tenant policy `updateWindowMinutes`; otherwise **409**. Policy from `TenantCategory.settings.ratings` (see `rating-policy.ts`).

| Method | Path | Status |
|--------|------|--------|
| POST | `/` | ✅ create / upsert-in-window |
| GET | `/` | ✅ `?tenantId=` required; optional `sessionId`, `targetType` |
| GET | `/:id` | ✅ |
| PATCH | `/:id` | ✅ within policy edit window |

## Payments — ClickPesa (`/api/v1/payments`)

Per-tenant credentials encrypted with `PAYMENTS_CREDENTIALS_SECRET` (AES-256-GCM). API returns **masked** previews only.

| Method | Path | Status |
|--------|------|--------|
| POST | `/payments/provider-config` | ✅ upsert `CLICKPESA` row |
| GET | `/payments/provider-config?tenantId=` | ✅ masked list |
| GET | `/payments/provider-config/:id` | ✅ masked |
| POST | `/payments/collections` | ✅ token → preview USSD → initiate; idempotent `orderReference` |
| POST | `/payments/payouts` | ✅ preview + create (tenant `payoutEnabled`) |
| GET | `/payments/transactions?tenantId=` | ✅ optional `type` |
| GET | `/payments/transactions/:id` | ✅ |
| POST | `/payments/transactions/:id/refresh-status` | ✅ provider query |
| POST | `/payments/transactions/:id/initiate-ussd` | ✅ pending COLLECTION / TIP_DIGITAL |

| Method | Path | Auth | Status |
|--------|------|------|--------|
| POST | `/payments/webhooks/clickpesa/:tenantId` | **Public** | ✅ optional `x-tiptap-webhook-secret` when `webhookSecret` set in creds |

### Payments — merchant dashboard (`/api/v1/payments/dashboard`)

JWT + `RolesGuard`. `SUPER_ADMIN`, `TENANT_OWNER`, `BRANCH_MANAGER`, `CASHIER`, `SUPPORT_AGENT`.

| Method | Path | Status |
|--------|------|--------|
| GET | `/payments/dashboard` | ✅ summary + optional per-tenant config health |
| GET | `/payments/dashboard/config-health` | ✅ `?tenantId=` required; masked credentials only |
| GET | `/payments/dashboard/recent-transactions` | ✅ paginated `?tenantId=` + optional filters |
| GET | `/payments/dashboard/reconciliation-flags` | ✅ stale pending / failures / webhook heuristic |

## Analytics (`/api/v1/analytics`)

JWT + `RolesGuard`. `SUPER_ADMIN` may omit `tenantId` for **platform-wide** aggregates (expensive). Others: `tenantId` required or inferable (single-owner / single-tenant BM). Optional `branchId`, `startDate`, `endDate`, `groupBy` (`day` \| `week` \| `month`).

| Method | Path | Status |
|--------|------|--------|
| GET | `/analytics/overview` | ✅ |
| GET | `/analytics/payments` | ✅ optional `type`, `status` |
| GET | `/analytics/tips` | ✅ optional `staffId` |
| GET | `/analytics/ratings` | ✅ optional `lowScoreMax` |
| GET | `/analytics/operations` | ✅ waiter/bill/assistance/dining support |
| GET | `/analytics/food-dining` | ✅ category snapshot when FOOD_DINING enabled |
| GET | `/analytics/beauty-grooming` | ✅ category snapshot when BEAUTY enabled |

## Statements (`/api/v1/statements`)

On-demand aggregates (not stored). JWT + same analytics-capable roles.

| Method | Path | Status |
|--------|------|--------|
| GET | `/statements` | ✅ `?tenantId=&startDate=&endDate=` optional `branchId` |
| GET | `/statements/by-key/:statementKey` | ✅ base64url-encoded param blob (URL-encode when calling) |
| POST | `/statements/generate` | ✅ same fields in body |

## Reconciliation (`/api/v1/reconciliation`)

Read-only mismatch / exception visibility (no settlement engine).

| Method | Path | Status |
|--------|------|--------|
| GET | `/reconciliation/overview` | ✅ counts: mismatch, stale pending, payout queue |
| GET | `/reconciliation/transactions` | ✅ paginated; `mismatchOnly=true` |
| GET | `/reconciliation/exceptions` | ✅ sample rows |

## Audit logs — read API (`/api/v1/audit-logs`)

JWT + `SUPER_ADMIN` \| `TENANT_OWNER` \| `BRANCH_MANAGER` \| `SUPPORT_AGENT`. Writes remain via `AuditService` only.

| Method | Path | Status |
|--------|------|--------|
| GET | `/audit-logs` | ✅ filters: tenant, branch, actor, entity, correlation, dates, pagination |
| GET | `/audit-logs/:id` | ✅ scoped by tenant/branch access |

## Tips (`/api/v1/tips`)

| Method | Path | Status |
|--------|------|--------|
| POST | `/` | ✅ `CASH` → `RECORDED`; `DIGITAL` → `Tip` + `PaymentTransaction` TIP_DIGITAL + USSD |
| GET | `/` | ✅ `?tenantId=` |
| GET | `/:id` | ✅ includes `paymentTxn` |
| PATCH | `/:id` | ✅ status (owner/manager) |

## FOOD_DINING (`/api/v1/food-dining/...`)

JWT + `RolesGuard`. Lists use `?tenantId=` (required for SUPER_ADMIN; inferable for single-tenant owner). Optional `?branchId=` scopes menu/table/ops lists.

| Method | Path | Status |
|--------|------|--------|
| POST | `/food-dining/menu-categories` | ✅ |
| GET | `/food-dining/menu-categories` | ✅ optional `branchId`, `activeOnly` |
| GET | `/food-dining/menu-categories/:id` | ✅ |
| PATCH | `/food-dining/menu-categories/:id` | ✅ (incl. deactivate via `isActive`) |
| POST | `/food-dining/menu-items` | ✅ |
| POST | `/food-dining/menu-items/upload` | ✅ multipart `file`; query `tenantId`, optional `branchId` — returns `path` for `imageUrl` (JPEG/PNG/WebP/GIF, max 5MB) |
| GET | `/food-dining/menu-items` | ✅ optional `branchId`, `categoryId`, `activeOnly` |
| GET | `/food-dining/menu-items/:id` | ✅ |
| PATCH | `/food-dining/menu-items/:id` | ✅ |
| POST | `/food-dining/tables` | ✅ |
| GET | `/food-dining/tables` | ✅ |
| GET | `/food-dining/tables/:id` | ✅ |
| PATCH | `/food-dining/tables/:id` | ✅ (`DiningTableStatus`, capacity, etc.) |
| POST | `/food-dining/waiter-calls` | ✅ staff/manual create |
| GET | `/food-dining/waiter-calls` | ✅ optional `status` |
| GET | `/food-dining/waiter-calls/:id` | ✅ |
| PATCH | `/food-dining/waiter-calls/:id` | ✅ status lifecycle + audit |
| POST | `/food-dining/bill-requests` | ✅ |
| GET | `/food-dining/bill-requests` | ✅ |
| GET | `/food-dining/bill-requests/:id` | ✅ |
| PATCH | `/food-dining/bill-requests/:id` | ✅ status + audit |
| POST | `/food-dining/orders` | ✅ staff (incl. floor roles); optional `items[]` |
| GET | `/food-dining/orders` | ✅ `?tenantId=` optional `branchId`, `status`, `staffId` |
| GET | `/food-dining/orders/:id` | ✅ order + items + menu snapshot |
| PATCH | `/food-dining/orders/:id` | ✅ status, notes, `taxCents`, `paymentMethod`, `paidAt` |
| POST | `/food-dining/orders/:id/claim` | ✅ JWT user must have `Staff` row on tenant |
| POST | `/food-dining/orders/:id/portal-token` | ✅ mint/rotate — returns **`rawToken` once** (SHA-256 stored) |
| DELETE | `/food-dining/orders/:id/portal-token` | ✅ revoke portal link |
| POST | `/food-dining/orders/:id/items` | ✅ add line |
| PATCH | `/food-dining/orders/:id/items/:itemId` | ✅ quantity, **KDS** item `status`, notes |
| DELETE | `/food-dining/orders/:id/items/:itemId` | ✅ |

### KDS — Kitchen Display (`/api/v1/food-dining/kds/...`)

JWT **manager** routes (`BRANCH_MANAGER`, `TENANT_OWNER`, `SUPER_ADMIN`):

| Method | Path | Status |
|--------|------|--------|
| POST | `/food-dining/kds/tokens` | ✅ body: `tenantId`, `branchId`, `name`, optional `expiresAt` — returns **`rawToken` once** |
| GET | `/food-dining/kds/tokens` | ✅ `?tenantId=` optional `branchId` — no secrets |
| POST | `/food-dining/kds/tokens/:id/revoke` | ✅ |

**Public** (opaque `token` in path = raw token from create; rate-limited):

| Method | Path | Status |
|--------|------|--------|
| GET | `/food-dining/kds/:token/orders` | ✅ live orders (excludes `COMPLETED`/`CANCELLED`) |
| GET | `/food-dining/kds/:token/history` | ✅ recent `COMPLETED` orders |
| PATCH | `/food-dining/kds/:token/items/:itemId` | ✅ body `{ status: PENDING \| PREPARING \| READY }` |

### Customer portal — single order (Phase 9)

**Public** (rate-limited): opaque `token` in path = raw token from `POST .../orders/:id/portal-token`.

| Method | Path | Status |
|--------|------|--------|
| GET | `/food-dining/order-portal/:token` | ✅ read-only order snapshot (branch name/code, lines, totals); **404** if revoked/unknown |

**Conversation:** FOOD_DINING sessions use `FoodDiningConversationEngine` — real categories/items from DB; from **FOOD_MENU_ITEMS**, choosing an available item number **creates or appends** a `DiningOrder` for the session (TABLE / branch context). Options **2** / **3** / **4** create `BillRequest` / `WaiterCallRequest` / `DiningCustomerServiceRequest` when `session.branchId` is set. Option **7** starts **in-chat ratings**. Bare `BUSINESS_QR` without branch returns an explicit “scan table/branch QR” message.

## BEAUTY_GROOMING (`/api/v1/beauty-grooming/...`)

JWT + `RolesGuard`. Same `tenantId` / `branchId` query patterns as food-dining.

| Method | Path | Status |
|--------|------|--------|
| POST | `/beauty-grooming/service-categories` | ✅ |
| GET | `/beauty-grooming/service-categories` | ✅ optional `branchId`, `activeOnly` |
| GET | `/beauty-grooming/service-categories/:id` | ✅ |
| PATCH | `/beauty-grooming/service-categories/:id` | ✅ |
| POST | `/beauty-grooming/services` | ✅ (`durationMinutes` → `durationMin`; `isAvailable` → `isActive`) |
| POST | `/beauty-grooming/services/upload` | ✅ multipart `file`; query `tenantId`, optional `branchId` — `path` for `imageUrl` (same limits as menu) |
| GET | `/beauty-grooming/services` | ✅ optional `branchId`, `categoryId`, `activeOnly` |
| GET | `/beauty-grooming/services/:id` | ✅ |
| PATCH | `/beauty-grooming/services/:id` | ✅ |
| POST | `/beauty-grooming/stations` | ✅ |
| GET | `/beauty-grooming/stations` | ✅ |
| GET | `/beauty-grooming/stations/:id` | ✅ |
| PATCH | `/beauty-grooming/stations/:id` | ✅ |
| POST | `/beauty-grooming/specializations` | ✅ (`tenantId` + `staffId` + optional category/service links) |
| GET | `/beauty-grooming/specializations` | ✅ optional `staffId` |
| GET | `/beauty-grooming/specializations/:id` | ✅ |
| PATCH | `/beauty-grooming/specializations/:id` | ✅ |
| POST | `/beauty-grooming/assistance-requests` | ✅ |
| GET | `/beauty-grooming/assistance-requests` | ✅ optional `branchId`, `status` |
| GET | `/beauty-grooming/assistance-requests/:id` | ✅ |
| PATCH | `/beauty-grooming/assistance-requests/:id` | ✅ |
| POST | `/beauty-grooming/bookings` | ✅ staff; optional `services[]`, `scheduledAt`, `isWalkIn`; **`scheduledAt`** checked vs branch **`operatingHours`** when set (local day/time in branch `timezone`) |
| GET | `/beauty-grooming/bookings` | ✅ optional `branchId`, `status`, `staffId`, `date=YYYY-MM-DD` |
| GET | `/beauty-grooming/bookings/:id` | ✅ booking + service lines |
| PATCH | `/beauty-grooming/bookings/:id` | ✅ status, `staffId`, `scheduledAt` (re-validated vs hours), notes |
| POST | `/beauty-grooming/bookings/:id/check-in` | ✅ `BOOKED`/`CONFIRMED` → `CHECKED_IN` |
| POST | `/beauty-grooming/bookings/:id/portal-token` | ✅ mint/rotate — **`rawToken` once** |
| DELETE | `/beauty-grooming/bookings/:id/portal-token` | ✅ revoke |
| POST | `/beauty-grooming/bookings/:id/services` | ✅ add line |
| PATCH | `/beauty-grooming/bookings/:id/services/:serviceId` | ✅ line status / times |

### QDS — Queue Display (`/api/v1/beauty-grooming/qds/...`)

JWT (`BRANCH_MANAGER`, `TENANT_OWNER`, `SUPER_ADMIN`): `POST/GET .../qds/tokens`, `POST .../qds/tokens/:id/revoke` — same pattern as KDS; create returns **`rawToken` once**.

**Public** (rate-limited): `GET .../qds/:token/queue`, `GET .../qds/:token/providers`, `PATCH .../qds/:token/bookings/:id` with `{ status }`.

**Customer portal — single booking (Phase 9):** `GET /beauty-grooming/booking-portal/:token` — read-only booking snapshot; **404** if revoked/unknown.

**Conversation:** `BeautyGroomingConversationEngine` — real service categories/services; from **BEAUTY_MENU_SERVICES**, choosing an active service number **creates or appends** a walk-in `BeautyBooking` (`CHECKED_IN`) for the session when branch context exists. **2** / **3** create `AssistanceRequest` when `session.branchId` is set. Option **6** starts **ratings**. **STAFF_QR** sets `hostName`. E2E: `test/phase4b-beauty-grooming.e2e-spec.ts`, `test/phase7-orders-bookings.e2e-spec.ts`.

## RBAC

| Item | Status |
|------|--------|
| `@CurrentUser()` | ✅ |
| `@Roles(...)` + `RolesGuard` | ✅ |
| `JwtAuthGuard` + `JwtStrategy` (DB user + assignments) | ✅ |
| `TenantAccessService` (tenant/branch assertions) | ✅ |

## Audit

| Event | Status |
|-------|--------|
| Register, login, logout, logout-all | ✅ |
| Refresh reuse detection | ✅ |
| Tenant / branch / staff / QR / provider (writes) | ✅ |
| FOOD waiter/bill/support created from conversation (`actorType` **CONVERSATION_SESSION**) | ✅ |
| FOOD dining order / order lines from conversation or staff API | ✅ |
| FOOD menu/table CRUD (staff) | ✅ |
| BEAUTY assistance from conversation (`actorType` **CONVERSATION_SESSION**) | ✅ |
| BEAUTY bookings / booking lines from conversation or staff API | ✅ |
| KDS / QDS token create + revoke (manager) | ✅ |
| Dining / beauty **customer portal** token mint + revoke | ✅ |
| BEAUTY catalog / stations / specializations / assistance CRUD | ✅ |
| Rating create/update (JWT + conversation via `RatingsService`) | ✅ |
| Payment provider config + txn create/query + webhook (`actorType` **WEBHOOK**) | ✅ |
| Tip create (cash/digital) | ✅ |
| Audit **read** APIs (`GET /audit-logs`, `GET /audit-logs/:id`) | ✅ |

## Remaining (post Phase 6)

- Heavy analytics caching / materialized views; async exports.
- Full settlement automation, fee ingestion from provider, chargeback workflows.
- Frontend dashboards (out of scope for this backend phase).
