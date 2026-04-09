#!/usr/bin/env bash
# Safisha stack, futa data ya Postgres/Redis, jenga upya, endesha migrations (kupitia api), seed admin.
# Tumia kutoka mizizi ya mradi:  bash infra/docker/restart-fresh.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
COMPOSE=(docker compose -f infra/docker/docker-compose.yml)

echo "==> 1/4 docker compose down -v (simamisha na futa volumes)"
"${COMPOSE[@]}" down -v

echo "==> 2/4 docker compose up --build -d"
"${COMPOSE[@]}" up --build -d

echo "==> 3/4 Subiri API /health (migrations huendeshwa na api wakati wa kuanza)..."
ok=0
for i in $(seq 1 45); do
  if curl -sf "http://127.0.0.1:3000/health" >/dev/null 2>&1; then
    ok=1
    echo "    API iko tayari."
    break
  fi
  echo "    jaribu $i/45 ..."
  sleep 2
done
if [ "$ok" != 1 ]; then
  echo "    IMESHINDIKANA: API haiji. Angalia: docker compose -f infra/docker/docker-compose.yml logs api"
  exit 1
fi

echo "==> 4/4 Seed (SUPER_ADMIN + data za mfano; reset password ya admin)"
SEED_RESET_ADMIN_PASSWORD=true "${COMPOSE[@]}" --profile seed run --rm seed

echo ""
echo "Imekamilika."
echo "  Web:  http://localhost:3001"
echo "  API:  http://localhost:3000/docs"
echo "  Login: admin@tiptap.local  /  ChangeMe!123"
echo "  (pia) owner.harbor@tiptap.local  /  TenantOwner!123"
echo ""
echo "==> Jaribio la login (lazima uone accessToken kwenye JSON):"
resp="$(curl -sS -X POST "http://127.0.0.1:3000/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@tiptap.local","password":"ChangeMe!123"}')" || true
echo "$resp" | head -c 320
echo ""
if echo "$resp" | grep -q 'accessToken'; then
  echo "    OK: API inakubali admin@tiptap.local — tumia vivyo hivyo kwenye browser."
else
  echo "    LA: Hakuna token — endesha seed tena au soma '401' katika infra/docker/README.md"
fi
echo ""
