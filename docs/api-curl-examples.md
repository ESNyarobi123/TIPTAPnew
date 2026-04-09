# API examples (cURL)

Base URL: `http://localhost:3000` (adjust host/port).

## Health (unversioned)

```bash
curl -sS http://localhost:3000/health
curl -sS http://localhost:3000/ready
```

## Register / login (bcrypt + refresh token)

```bash
curl -sS -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"SecurePass1ab","firstName":"You"}'

curl -sS -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"SecurePass1ab"}'
```

Use `accessToken` as `Authorization: Bearer ...`. Refresh:

```bash
curl -sS -X POST http://localhost:3000/api/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<opaque-from-login>"}'
```

## Branches (tenant-scoped collection)

```bash
TENANT_ID=<tenant-cuid>
TOKEN=<accessToken>

curl -sS -X POST "http://localhost:3000/api/v1/tenants/${TENANT_ID}/branches" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Main","code":"M1"}'

curl -sS "http://localhost:3000/api/v1/tenants/${TENANT_ID}/branches" \
  -H "Authorization: Bearer ${TOKEN}"
```

## Staff

```bash
curl -sS -X POST http://localhost:3000/api/v1/staff \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"${TENANT_ID}\",\"displayName\":\"Alex\"}"

curl -sS "http://localhost:3000/api/v1/staff?tenantId=${TENANT_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
```

## QR (create + resolve + conversation)

```bash
QR=$(curl -sS -X POST http://localhost:3000/api/v1/qr \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"${TENANT_ID}\",\"type\":\"BUSINESS_QR\"}")

RAW=$(echo "$QR" | jq -r .rawToken)

curl -sS -X POST http://localhost:3000/api/v1/qr/resolve \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"${RAW}\"}"

curl -sS -X POST http://localhost:3000/api/v1/conversations/start \
  -H 'Content-Type: application/json' \
  -d "{\"qrToken\":\"${RAW}\",\"language\":\"en\"}"
```

Use **`sessionToken`** from the start response (no internal id is returned). Message and session reads:

```bash
ST=$(jq -r .sessionToken <<<"$START_JSON")

curl -sS -X POST http://localhost:3000/api/v1/conversations/message \
  -H 'Content-Type: application/json' \
  -d "{\"sessionToken\":\"${ST}\",\"text\":\"1\"}"

curl -sS http://localhost:3000/api/v1/conversations/session \
  -H "X-Session-Token: ${ST}"
```

Tenant-scoped QR create:

```bash
curl -sS -X POST "http://localhost:3000/api/v1/tenants/${TENANT_ID}/qr" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"type":"BUSINESS_QR"}'
```

## FOOD_DINING (menu, tables, ops)

Replace `TENANT_ID`, `BRANCH_ID`, `TOKEN`, and IDs from prior responses.

```bash
# Menu category (tenant-wide: omit branchId)
curl -sS -X POST http://localhost:3000/api/v1/food-dining/menu-categories \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"${TENANT_ID}\",\"name\":\"Mains\",\"sortOrder\":1}"

CAT_ID=<category-cuid>

curl -sS -X POST http://localhost:3000/api/v1/food-dining/menu-items \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"${TENANT_ID}\",\"categoryId\":\"${CAT_ID}\",\"name\":\"Fish\",\"priceCents\":1200,\"currency\":\"USD\"}"

curl -sS "http://localhost:3000/api/v1/food-dining/menu-categories?tenantId=${TENANT_ID}" \
  -H "Authorization: Bearer ${TOKEN}"

# Table + TABLE_QR (branch required)
curl -sS -X POST http://localhost:3000/api/v1/food-dining/tables \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"${TENANT_ID}\",\"branchId\":\"${BRANCH_ID}\",\"code\":\"T12\"}"

TABLE_ID=<table-cuid>

curl -sS -X POST http://localhost:3000/api/v1/qr \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"${TENANT_ID}\",\"branchId\":\"${BRANCH_ID}\",\"type\":\"TABLE_QR\",\"diningTableId\":\"${TABLE_ID}\"}"

# Staff: patch waiter call / bill request status
curl -sS -X PATCH "http://localhost:3000/api/v1/food-dining/waiter-calls/${WAITER_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"status":"ACKNOWLEDGED"}'
```

## BEAUTY_GROOMING (catalog, stations, assistance)

```bash
# Service category
curl -sS -X POST http://localhost:3000/api/v1/beauty-grooming/service-categories \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"${TENANT_ID}\",\"name\":\"Hair\",\"sortOrder\":1}"

BEAUTY_CAT_ID=<category-cuid>

curl -sS -X POST http://localhost:3000/api/v1/beauty-grooming/services \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"${TENANT_ID}\",\"categoryId\":\"${BEAUTY_CAT_ID}\",\"name\":\"Cut\",\"priceCents\":3000,\"currency\":\"USD\",\"durationMinutes\":45,\"isAvailable\":true}"

# Station + STATION_QR
curl -sS -X POST http://localhost:3000/api/v1/beauty-grooming/stations \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"${TENANT_ID}\",\"branchId\":\"${BRANCH_ID}\",\"code\":\"S1\"}"

STATION_ID=<station-cuid>

curl -sS -X POST http://localhost:3000/api/v1/qr \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"${TENANT_ID}\",\"branchId\":\"${BRANCH_ID}\",\"type\":\"STATION_QR\",\"beautyStationId\":\"${STATION_ID}\"}"

# Assistance request (staff API)
curl -sS -X POST http://localhost:3000/api/v1/beauty-grooming/assistance-requests \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"${TENANT_ID}\",\"branchId\":\"${BRANCH_ID}\",\"stationId\":\"${STATION_ID}\"}"
```

## Ratings, payments, tips (Phase 5)

Set `PAYMENTS_CREDENTIALS_SECRET` in `apps/api/.env` before storing provider keys.

```bash
# Upsert ClickPesa config (per tenant)
curl -sS -X POST http://localhost:3000/api/v1/payments/provider-config \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"${TENANT_ID}\",\"clientId\":\"<from-dashboard>\",\"apiKey\":\"<from-dashboard>\",\"collectionEnabled\":true,\"payoutEnabled\":false}"

# USSD collection
curl -sS -X POST http://localhost:3000/api/v1/payments/collections \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"${TENANT_ID}\",\"amountCents\":5000,\"currency\":\"TZS\",\"phoneNumber\":\"+2557XXXXXXXX\"}"

# Webhook (configure URL + secret in ClickPesa dashboard to match)
curl -sS -X POST "http://localhost:3000/api/v1/payments/webhooks/clickpesa/${TENANT_ID}" \
  -H 'Content-Type: application/json' \
  -H 'x-tiptap-webhook-secret: <same-as-stored-webhookSecret>' \
  -d '{"orderReference":"<txn-orderReference>","status":"SUCCESS"}'

# Rating (requires real conversation session id from staff tools / DB)
SESSION_ID=<internal-session-cuid>
curl -sS -X POST http://localhost:3000/api/v1/ratings \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"${TENANT_ID}\",\"sessionId\":\"${SESSION_ID}\",\"targetType\":\"BUSINESS\",\"targetId\":\"${TENANT_ID}\",\"score\":5}"

# Cash tip
STAFF_ID=<staff-cuid>
curl -sS -X POST http://localhost:3000/api/v1/tips \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"${TENANT_ID}\",\"branchId\":\"${BRANCH_ID}\",\"staffId\":\"${STAFF_ID}\",\"mode\":\"CASH\",\"amountCents\":1000,\"currency\":\"USD\"}"

# Digital tip (starts USSD; needs collection-enabled ClickPesa config)
curl -sS -X POST http://localhost:3000/api/v1/tips \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"${TENANT_ID}\",\"branchId\":\"${BRANCH_ID}\",\"staffId\":\"${STAFF_ID}\",\"mode\":\"DIGITAL\",\"amountCents\":2000,\"currency\":\"TZS\",\"phoneNumber\":\"+2557XXXXXXXX\"}"
```

## Analytics, dashboards, statements, reconciliation (Phase 6)

```bash
# Analytics overview (tenant-scoped)
curl -sS "http://localhost:3000/api/v1/analytics/overview?tenantId=${TENANT_ID}" \
  -H "Authorization: Bearer ${TOKEN}"

# Payment dashboard + config health
curl -sS "http://localhost:3000/api/v1/payments/dashboard?tenantId=${TENANT_ID}" \
  -H "Authorization: Bearer ${TOKEN}"

curl -sS "http://localhost:3000/api/v1/payments/dashboard/config-health?tenantId=${TENANT_ID}" \
  -H "Authorization: Bearer ${TOKEN}"

curl -sS "http://localhost:3000/api/v1/payments/dashboard/recent-transactions?tenantId=${TENANT_ID}&page=1&pageSize=20" \
  -H "Authorization: Bearer ${TOKEN}"

# On-demand statement (encode dates as ISO)
curl -sS -G "http://localhost:3000/api/v1/statements" \
  -H "Authorization: Bearer ${TOKEN}" \
  --data-urlencode "tenantId=${TENANT_ID}" \
  --data-urlencode "startDate=2025-01-01T00:00:00.000Z" \
  --data-urlencode "endDate=2026-01-01T00:00:00.000Z"

# Reconciliation
curl -sS "http://localhost:3000/api/v1/reconciliation/overview?tenantId=${TENANT_ID}" \
  -H "Authorization: Bearer ${TOKEN}"

curl -sS "http://localhost:3000/api/v1/reconciliation/transactions?tenantId=${TENANT_ID}&mismatchOnly=true" \
  -H "Authorization: Bearer ${TOKEN}"

# Audit trail (read)
curl -sS "http://localhost:3000/api/v1/audit-logs?tenantId=${TENANT_ID}&page=1&pageSize=50" \
  -H "Authorization: Bearer ${TOKEN}"
```

## Correlation ID

Responses echo `x-correlation-id` when generated or forwarded from `x-request-id` / `x-correlation-id`.
