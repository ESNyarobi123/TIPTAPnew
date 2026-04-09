# TIPTAP

Backend-first monorepo for a **multi-tenant** service-commerce platform (FOOD_DINING, BEAUTY_GROOMING): NestJS API, optional bot gateway, BullMQ worker, shared packages.

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/architecture-overview.md](docs/architecture-overview.md) | System shape and modules |
| [docs/multi-tenant-strategy.md](docs/multi-tenant-strategy.md) | Tenancy + RBAC rules |
| [docs/domain-model.md](docs/domain-model.md) | Prisma entities |
| [docs/api-status.md](docs/api-status.md) | **Implementation checklist** by phase (through **Phase 6**: analytics, dashboards, statements, reconciliation) |
| [docs/conversation-engine.md](docs/conversation-engine.md) | Session / state design |
| [docs/food-dining-module.md](docs/food-dining-module.md) | Vertical: dining |
| [docs/beauty-grooming-module.md](docs/beauty-grooming-module.md) | Vertical: beauty |
| [docs/payments-architecture.md](docs/payments-architecture.md) | PSP abstraction |
| [docs/testing-strategy.md](docs/testing-strategy.md) | Jest / e2e |
| [docs/auth-and-tokens.md](docs/auth-and-tokens.md) | JWT + refresh flow |
| [docs/api-curl-examples.md](docs/api-curl-examples.md) | cURL samples |
| [docs/postman/tiptap-api.postman_collection.json](docs/postman/tiptap-api.postman_collection.json) | Postman v2.1 |

## Prerequisites

- Node.js 20+
- pnpm 9+ (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- Docker (for Postgres + Redis)

## Quick start

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
make docker-up
# Apply schema (from repo root)
pnpm --filter @tiptap/api exec prisma migrate deploy
pnpm db:generate
# Migrations include Phase 4–6 (food/beauty ops, ratings, payments, tips, reporting indexes) — run migrate after pull
pnpm --filter @tiptap/api exec prisma db seed
pnpm --filter @tiptap/api dev
```

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`
- Liveness: `GET http://localhost:3000/health`
- Readiness: `GET http://localhost:3000/ready`

## Seed users (after `prisma db seed`)

| Email | Role | Password (default) |
|-------|------|---------------------|
| `admin@tiptap.local` | SUPER_ADMIN | `ChangeMe!123` |
| `owner.harbor@tiptap.local` | TENANT_OWNER (Harbor Bistro) | `TenantOwner!123` |
| `owner.glow@tiptap.local` | TENANT_OWNER (Studio Glow) | `TenantOwner!123` |
| `staff.harbor@tiptap.local` | (staff user, SERVICE_STAFF) | `ServiceStaff!123` |

Override admin email/password with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

## Folder structure (high level)

```
apps/api/src/
  common/          # filters, interceptors, pipes, DTOs, …
  config/          # ConfigModule loaders + Joi schema
  database/prisma/ # PrismaModule + PrismaService
  modules/         # auth, users, tenants, … + food-dining + beauty-grooming
apps/api/prisma/   # schema + migrations
apps/bot-gateway/
apps/worker/
packages/          # shared-types, config, utils, api-contracts
docs/
infra/docker/      # docker-compose.yml
```

## E2E database

Integration tests use a **real PostgreSQL** database (default `postgresql://postgres:postgres@localhost:5432/tiptap_test`). Create it and apply migrations:

```bash
createdb tiptap_test
export E2E_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tiptap_test
pnpm --filter @tiptap/api exec prisma migrate deploy
pnpm --filter @tiptap/api test:e2e
```

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm build` | Turbo build |
| `pnpm --filter @tiptap/api test:e2e` | API e2e (needs DB) |
| `pnpm db:generate` | `prisma generate` |
| `./infra/scripts/bootstrap.sh` | Install + env copy + generate |

## Implementation phases

See [docs/api-status.md](docs/api-status.md). **Phase 1**–**3** (foundation through QR + conversations), **Phase 4A** / **4B** (vertical CRUD + operational chat flows), **Phase 5** (ratings, ClickPesa, tips, webhooks), and **Phase 6** (analytics, payment dashboards, audit reads, statements, reconciliation views) are implemented in the API module. E2E: `test/phase4a-food-dining.e2e-spec.ts`, `test/phase4b-beauty-grooming.e2e-spec.ts`, `test/phase5-ratings-payments-tips.e2e-spec.ts`, `test/phase6-analytics-reporting.e2e-spec.ts`.
