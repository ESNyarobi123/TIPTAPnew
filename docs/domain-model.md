# Domain model (Prisma)

Single schema: `apps/api/prisma/schema.prisma`. Initial migration: `prisma/migrations/20260407000000_init_tiptap_domain/`.

## Enums (summary)

- **RoleCode** — `SUPER_ADMIN`, `TENANT_OWNER`, `BRANCH_MANAGER`, `CASHIER`, `SERVICE_STAFF`, `SUPPORT_AGENT`
- **BusinessCategory** — `FOOD_DINING`, `BEAUTY_GROOMING`
- **TenantStatus** — `ACTIVE`, `TRIAL`, `SUSPENDED`, `ARCHIVED`
- **QrType** — `BUSINESS_QR`, `STAFF_QR`, `TABLE_QR`, `STATION_QR`
- **QrStatus** — `ACTIVE`, `REVOKED`, `EXPIRED`
- **StaffAssignmentStatus** — `ACTIVE`, `ENDED`
- **ConversationChannel**, **MessageDirection**, employment and operational statuses for dining/beauty/payments/audit (see schema)
- **RatingTargetType**, **TipMode**, **PaymentTransactionType**, **PaymentProviderKey** (includes `CLICKPESA`)

## Core entities

| Model | Purpose |
|--------|---------|
| **User** | Login identity; `passwordHash`; `passwordChangedAt`; `isActive`; soft delete `deletedAt` |
| **UserRoleAssignment** | RBAC with optional tenant/branch scope |
| **RefreshToken** | `tokenHash` (SHA-256 of opaque token), `expiresAt`, `revokedAt`, `lastUsedAt`, optional `userAgent` / `ipAddress` |
| **Tenant** | Business; slug; optional `legalName`, `email`, `phone`; subscription placeholders; metadata |
| **Branch** | Location/contact; unique `(tenantId, code)`; optional **`operatingHours`** JSON (weekly `mon`…`sun` intervals, `{ open, close }` HH:mm in branch timezone) |
| **TenantCategory** | Enabled vertical + JSON settings |
| **Staff** | Tenant staff; optional `User`, `ProviderProfile`, `publicHandle` / `privateNotes` |
| **StaffAssignment** | Staff ↔ branch; `status`; `endedAt` history |
| **ProviderProfile** | Portable public profile; `skills` (JSON); `internalNotes` (never public) |
| **QrCode** | `tokenHash` (SHA-256 of secret), `publicRef`, `status`, `scanCount`, `lastScannedAt`, `rotatedAt`, typed links |
| **ConversationSession** | `clientTokenHash`, `qrContext`, `expiresAt`, `lastActivityAt`; `currentState`, `menuState`, language, context FKs |
| **ConversationMessage** | Inbound/outbound transcript |
| **Rating** | `RatingTargetType` (`BUSINESS`, `STAFF`, `SERVICE`, `PROVIDER_EXPERIENCE`) + `targetId`; `vertical` (`BusinessCategory`); `sessionId` recommended; partial unique on `(sessionId, targetType, targetId)` when session set and not soft-deleted; index `(tenantId, createdAt)` for analytics |
| **Tip** | `TipMode` `CASH` \| `DIGITAL`; `TipStatus` includes `RECORDED` (cash), `PENDING`/`COMPLETED`/`FAILED` (digital); optional `paymentTxnId`; index `(tenantId, createdAt)` for analytics |
| **PaymentProviderConfig** | Per-tenant `provider` (unique with `tenantId`); `credentialsEncrypted`; `collectionEnabled`, `payoutEnabled`, `isActive`; **`lastWebhookAt`** (last successful webhook that updated a txn — dashboard / reconciliation) |
| **PaymentTransaction** | `type` `COLLECTION` \| `PAYOUT` \| `TIP_DIGITAL`; unique `orderReference`; optional `branchId`, `sessionId`, `phoneNumber`, `rawRequest`/`rawResponse`, `lastProviderStatus`; indexed `(tenantId, type, createdAt)` for reporting |
| **AuditLog** | `actorUserId`, `actorType` (e.g. `USER`, `WEBHOOK`, `CONVERSATION_SESSION`), `action`, `entityType`/`entityId`, `tenantId`/`branchId`, `correlationId`, `summary`, `details`, `changes`, IP/UA; indexes `(tenantId, branchId, createdAt)`, `(actorUserId, createdAt)` for read APIs |

## FOOD_DINING

- **DiningMenuCategory** — `tenantId`, optional `branchId`, `sortOrder`, `isActive`
- **DiningMenuItem** — `categoryId`, `priceCents`, `currency`, `imageUrl`, `displayOrder`, `isAvailable`, optional `modifierSchema` (JSON) for add-ons/modifiers, `metadata`
- **DiningTable** — unique `(tenantId, branchId, code)`; `DiningTableStatus` (`AVAILABLE`, `OCCUPIED`, `RESERVED`, `OUT_OF_SERVICE`); `capacity`, `label`, `isActive`
- **WaiterCallRequest** — `branchId` required; optional `tableId`, `sessionId`, `staffId`; `WaiterCallStatus`: `PENDING`, `ACKNOWLEDGED`, `RESOLVED`, `CANCELLED`
- **BillRequest** — same spatial links; `BillRequestStatus`: `PENDING`, `ACKNOWLEDGED`, `RESOLVED`, `CANCELLED` (aligned with waiter/assistance operational vocabulary)
- **DiningCustomerServiceRequest** — branch + optional `sessionId`

## BEAUTY_GROOMING

- **BeautyServiceCategory** — optional `branchId`, `sortOrder`, `isActive`, soft delete
- **BeautyService** — `categoryId`, optional `durationMin`, optional `priceCents`/`currency`, `imageUrl`, `displayOrder`, `isActive` (API exposes `isAvailable` / `durationMinutes`), `metadata`
- **BeautyStation** — unique `(tenantId, branchId, code)`; `BeautyStationStatus`; optional `notes`
- **BeautyBooking** / **BeautyBookingService** — visit + service lines; `scheduledAt` validated against branch **`operatingHours`** when set (Phase 11)
- **ProviderSpecialization** — `staffId`, `title`, optional `beautyServiceCategoryId` / `beautyServiceId`
- **AssistanceRequest** — `branchId` required; optional `stationId`, `sessionId`, `staffId`; `AssistanceRequestStatus`: `PENDING`, `ACKNOWLEDGED`, `RESOLVED`, `CANCELLED`

## Indexes

Composite indexes on `(tenantId, …)` and foreign keys support tenant-scoped listing and joins. Phase 6 added reporting-friendly indexes on `PaymentTransaction`, `Tip`, `Rating`, and `AuditLog` (see migration `20260409000000_phase6_analytics_indexes`).
