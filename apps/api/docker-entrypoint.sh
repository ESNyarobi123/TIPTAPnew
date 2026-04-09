#!/bin/sh
set -e
cd /workspace
pnpm --filter @tiptap/api exec prisma migrate deploy
cd /workspace/apps/api
exec node dist/main.js
