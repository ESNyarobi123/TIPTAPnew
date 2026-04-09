# FOOD_DINING module (Phase 4A)

## Scope

Restaurant/café operations: **menu categories**, **menu items**, **`DiningOrder` + `DiningOrderItem`** (order numbers `ORD-{branchPrefix}-NNNN`, per-item status for future KDS), **dining tables** (with `DiningTableStatus`), **waiter calls**, **bill requests**, **dining customer service** tickets, and integration with **`TABLE_QR`** / branch-aware **`BUSINESS_QR`** conversation sessions.

## Data (Prisma)

| Model | Notes |
|-------|--------|
| `DiningMenuCategory` | `tenantId`, optional `branchId` (null = tenant-wide), `sortOrder`, `isActive`, soft-delete |
| `DiningMenuItem` | `categoryId`, `priceCents`, `currency`, `imageUrl`, `displayOrder`, `isAvailable`, `modifierSchema` (JSON), `metadata` |
| `DiningTable` | `branchId` required; unique `(tenantId, branchId, code)`; `status` (`AVAILABLE`, `OCCUPIED`, `RESERVED`, `OUT_OF_SERVICE`) |
| `WaiterCallRequest` | `branchId` required; optional `tableId`, `sessionId`, `staffId`; `status`: `PENDING`, `ACKNOWLEDGED`, `RESOLVED`, `CANCELLED` |
| `BillRequest` | Same scope fields; `status`: `PENDING`, `ACKNOWLEDGED`, `RESOLVED`, `CANCELLED` |
| `DiningCustomerServiceRequest` | Filed from conversation “customer support” when branch context exists |
| `DiningOrder` | `branchId`, optional `diningTableId`, `sessionId`, `customerPhone`, `orderNumber`, `DiningOrderStatus`, money fields, `claimedByStaffId` / `claimedAt` |
| `DiningOrderItem` | `menuItemId`, quantity, prices, `DiningOrderItemStatus`, optional `modifiers` JSON |

**Menu visibility:** For a session with `branchId`, the engine loads categories/items where `branchId` is **null** (tenant-wide) **or** equals the session branch.

## HTTP API (`/api/v1/food-dining/...`)

All routes require JWT unless noted. See [api-status.md](./api-status.md) for the matrix.

- **Authorization:** `SUPER_ADMIN` (any tenant via `?tenantId=`); `TENANT_OWNER` (own tenant); `BRANCH_MANAGER` may manage **branch-scoped** menu rows and all branch-scoped tables/ops; tenant-wide menu rows (`branchId` null) are **owner/super** only for writes.

## Waiter call lifecycle

1. **PENDING** — created (customer conversation, staff API, or manual). Customer path sets `sessionId`, optional `tableId` from QR/session.
2. **ACKNOWLEDGED** — floor staff has seen the request (`PATCH`).
3. **RESOLVED** — completed or dismissed on the floor.
4. **CANCELLED** — voided.

Creates/updates are written to **AuditLog** (JWT actor or `actorType: CONVERSATION_SESSION` for customer flows).

## Bill request lifecycle

1. **PENDING** — customer or staff created the request.
2. **ACKNOWLEDGED** — bill presented / acknowledged (operational milestone).
3. **RESOLVED** — closed / paid-out in ops terms (payment integration is separate).
4. **CANCELLED** — voided.

Audit on create/update from staff; customer-created rows use **CONVERSATION_SESSION** on create.

## QR / session / table context

| QR type | Session `branchId` | Session `diningTableId` | Bill / waiter / support from chat |
|---------|-------------------|-------------------------|-------------------------------------|
| `TABLE_QR` | From QR | From QR | ✅ Persisted with `tableId` + `sessionId` |
| `BUSINESS_QR` + `branchId` | Set | — | ✅ |
| `BUSINESS_QR` without branch | null | — | ❌ Engine returns an explicit **scan table or branch QR** message; nothing persisted |

## Conversation engine

- Implementation: `FoodDiningConversationEngine` (+ orchestration in `ConversationsService`).
- States: `ENTRY`, `MAIN_MENU`, `LANGUAGE_SELECT`, `FOOD_MENU_CATEGORIES`, `FOOD_MENU_ITEMS`, `EXIT`.
- **View menu:** loads real categories and items; **0** navigates back (items → categories → main).
- **Main menu:** **1** menu, **2** bill, **3** waiter, **4** support, **5** language, **6** exit, **7** rate.
- **Language:** option **5** then **1/2**; subsequent menu titles follow `en` / `sw`.
- **Order from chat:** on **FOOD_MENU_ITEMS**, a valid item number adds a line to the session’s open `DiningOrder` (or creates one).

## Related code

- `apps/api/src/modules/food-dining/*` — controllers, services, DTOs, access helper, conversation engine.
- `apps/api/test/phase4a-food-dining.e2e-spec.ts` — CRUD + conversation flows + cross-tenant negative case.
- `apps/api/test/phase7-orders-bookings.e2e-spec.ts` — orders API + chat add-to-order.
- **KDS (Phase 8):** `KdsToken` + public routes under `/food-dining/kds/...` — see [api-status.md](./api-status.md); e2e `test/phase8-kds-qds.e2e-spec.ts`.
- **Customer portal (Phase 9):** per-order opaque token — `POST/DELETE .../orders/:id/portal-token`, public `GET .../order-portal/:token` — [api-status.md](./api-status.md); e2e `test/phase9-customer-portal.e2e-spec.ts`.
- **Menu images:** `POST .../menu-items/upload` (multipart) → save `path` on `DiningMenuItem.imageUrl`; files served at `GET /api/v1/files/menu/{tenantId}/...`. Dashboard: `apps/web/.../food-dining/menu/page.tsx`.
