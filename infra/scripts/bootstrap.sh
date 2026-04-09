#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
corepack enable 2>/dev/null || true
pnpm install
cp -n apps/api/.env.example apps/api/.env 2>/dev/null || true
pnpm db:generate
echo "Bootstrap complete. Start Postgres/Redis (e.g. make docker-up) then run pnpm --filter @tiptap/api prisma:migrate"
