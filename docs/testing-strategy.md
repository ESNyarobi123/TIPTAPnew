# Testing strategy

## Layers

| Layer | Tool | Scope |
|-------|------|--------|
| Unit | Jest | Services, guards, conversation state transitions |
| Integration | Jest + Supertest + test DB | Repositories with real Postgres (optional CI service) |
| E2E | Jest + Supertest | HTTP contracts, auth, tenant isolation smoke |

## Current E2E (`apps/api/test/`)

- `setup-e2e-env.ts` — sets `NODE_ENV=test`, JWT secrets, default `DATABASE_URL` (override with `E2E_DATABASE_URL`).
- `integration-bootstrap.ts` — real `AppModule`, global prefix, filters, **no Prisma mock**.
- `health.e2e-spec.ts` — `/health`, `/ready` against real DB.
- `phase2-integration.e2e-spec.ts` — register/login/me, refresh rotation + reuse detection, logout, logout-all, inactive user, tenant + branch RBAC (requires PostgreSQL).
- `phase3-integration.e2e-spec.ts` — staff, assignments, provider public profile, QR create/resolve/revoke/rotate, conversation start/message/back/language/expiry.

**Before e2e:** create DB (e.g. `tiptap_test`), run `pnpm --filter @tiptap/api exec prisma migrate deploy` with that `DATABASE_URL` (includes migration `20260407160000_phase3_qr_session_provider`).

## Running

```bash
createdb tiptap_test   # once
export E2E_DATABASE_URL=postgresql://USER:PASS@localhost:5432/tiptap_test
pnpm --filter @tiptap/api exec prisma migrate deploy
pnpm --filter @tiptap/api test:e2e
```

## Next steps (Phase 4+)

- Optional Testcontainers for CI; expand unit tests for engine edge cases; vertical CRUD e2e.
