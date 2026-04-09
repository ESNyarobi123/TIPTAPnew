#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT/apps/api"
pnpm exec ts-node -r tsconfig-paths/register src/database/seeds/seed.ts
