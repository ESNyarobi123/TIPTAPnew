# TIPTAP — architecture overview

## Vision

TIPTAP is a **multi-tenant service-commerce** backend: businesses run operations on a shared platform while data is isolated per tenant. Customers interact via **QR** and **channel-agnostic conversation** flows (WhatsApp/Baileys is an external adapter; core logic lives in Nest).

## V1 categories

- **FOOD_DINING** — restaurants, cafés, seafood, dining.
- **BEAUTY_GROOMING** — salons, barbers, spas, studios.

The domain uses `BusinessCategory` in Prisma; new categories can be added as enum values plus dedicated modules without rewriting core tenancy, auth, or QR primitives.

## Modular monolith

Single deployable **NestJS** app (`apps/api`) with clear module boundaries:

| Layer | Responsibility |
|--------|------------------|
| **Platform** | Auth, users, RBAC, tenants, branches, categories, staff, provider registry, QR, conversations, ratings, tips, payments (abstraction), analytics, audit, health |
| **FOOD_DINING** | Menu, tables, waiter calls, bill requests, dining support, summaries |
| **BEAUTY_GROOMING** | Service catalog, stations, specializations, assistance, summaries |

Queues (**BullMQ** + **Redis**) support async work; **PostgreSQL** + **Prisma** is the system of record.

## Related apps (monorepo)

- **`apps/bot-gateway`** — future WhatsApp/Baileys edge; should call HTTP APIs on `conversations` / session services, not embed business rules.
- **`apps/worker`** — BullMQ consumers (notifications, analytics rollups, cleanup).

## API surface

- Versioned REST under **`/api/v1`**.
- **Liveness** `GET /health` and **readiness** `GET /ready` stay **outside** the version prefix for orchestrators.
- **OpenAPI** at `/docs` (configurable), server URL documented as `/api/v1`.

## Cross-cutting

- **Pino** HTTP logging (`nestjs-pino`).
- **Global validation** (`class-validator` / `class-transformer`).
- **Correlation ID** (`x-correlation-id` / `x-request-id` in, echoed on response).
- **HTTP exception filter** for consistent JSON errors.

## Evolution to microservices

Keep **tenant-scoped services**, **DTOs**, and **events** (future) at module edges so bounded contexts can move behind queues or HTTP later without changing contracts consumed by the bot gateway.
