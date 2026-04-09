# BEAUTY_GROOMING module

## Scope

Salon / barber / spa: **service catalog** (categories + services), **stations (chairs)**, **provider specializations**, **assistance requests**, **`BeautyBooking` + `BeautyBookingService`** (numbers `BKG-{branchPrefix}-NNNN`), and **QR** types `STATION_QR`, `BUSINESS_QR`, `STAFF_QR`.

## Data (Prisma)

- `BeautyServiceCategory`, `BeautyService`, `BeautyStation`, `ProviderSpecialization`, `AssistanceRequest`, `BeautyBooking`, `BeautyBookingService`
- **Money:** same as food-dining — `priceCents` + `currency` (ISO 4217, minor units).

### Beauty service: request vs JSON response fields

| Write (POST/PATCH body) | Stored / returned (Prisma JSON) |
|-------------------------|----------------------------------|
| `durationMinutes` | `durationMin` |
| `isAvailable` | `isActive` |
| `priceCents`, `currency` | `priceCents`, `currency` (unchanged) |

## REST API (`/api/v1/beauty-grooming/...`)

JWT + `RolesGuard`. **SUPER_ADMIN** passes `tenantId` on queries; **TENANT_OWNER** / **BRANCH_MANAGER** use scoped access via `TenantAccessService` + `BeautyGroomingAccessService` (mirror food-dining: tenant-wide catalog rows owner/super only; branch rows also branch managers).

| Area | Endpoints |
|------|-----------|
| Categories | `POST/GET/PATCH .../service-categories`, `GET .../:id` |
| Services | `POST/GET/PATCH .../services`, `POST .../services/upload` (image), `GET .../:id` |
| Stations | `POST/GET/PATCH .../stations`, `GET .../:id` |
| Specializations | `POST/GET/PATCH .../specializations`, `GET .../:id` |
| Assistance | `POST/GET/PATCH .../assistance-requests`, `GET .../:id` |
| Bookings | `POST/GET/PATCH .../bookings`, `GET .../:id`, `POST .../:id/check-in`, `POST .../:id/services`, `PATCH .../:id/services/:serviceId` |

List filters: `branchId`, `activeOnly` (categories/services), `categoryId` (services), `staffId` (specializations), `status` (assistance).

## Assistance lifecycle

- **Status enum:** `PENDING` → `ACKNOWLEDGED` → `RESOLVED` (or `CANCELLED`), aligned with waiter calls and bill requests.
- **From conversation:** `ConversationsService` calls `AssistanceRequestsService.createFromSession` when the customer chooses assistance or support and `session.branchId` is present; notes distinguish reception vs support.
- **Audit:** Staff CRUD uses `actorUserId`; session-created rows use `actorType: CONVERSATION_SESSION`.

## Conversation integration

See [conversation-engine.md](conversation-engine.md). Engine: `BeautyGroomingConversationEngine`. Customer flows use real DB categories/services; language persists on `ConversationSession`. On **BEAUTY_MENU_SERVICES**, picking a service adds a line to a walk-in `BeautyBooking` (`CHECKED_IN`) for the session when branch context exists.

## Bookings (Phase 7)

- **Walk-in from chat:** first service line creates `BeautyBooking` with `isWalkIn: true`, `CHECKED_IN`, `checkedInAt` set.
- **Staff API:** create with `scheduledAt` / `isWalkIn: false` for `BOOKED`; `POST .../check-in` moves `BOOKED`/`CONFIRMED` → `CHECKED_IN`.
- **E2E:** `apps/api/test/phase7-orders-bookings.e2e-spec.ts`.
- **QDS (Phase 8):** `QdsToken` + public `/beauty-grooming/qds/...` — see [api-status.md](./api-status.md); e2e `test/phase8-kds-qds.e2e-spec.ts`.
- **Customer portal (Phase 9):** per-booking token — `POST/DELETE .../bookings/:id/portal-token`, public `GET .../booking-portal/:token` — [api-status.md](./api-status.md); e2e `test/phase9-customer-portal.e2e-spec.ts`.
- **Scheduling vs branch hours (Phase 11):** if the branch has **`operatingHours`**, `scheduledAt` on create/patch must fall inside that day’s intervals in the branch **timezone** — e2e `test/phase11-booking-vs-branch-hours.e2e-spec.ts`.
- **Service images:** `POST .../services/upload` — same pattern as food menu; `imageUrl` points at `/api/v1/files/beauty-services/{tenantId}/...`. Dashboard: `apps/web/.../beauty-grooming/catalog/page.tsx`.
