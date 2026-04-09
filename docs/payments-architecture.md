# Payments architecture (Phase 5)

## Principles

- **Orchestrator only** — TIPTAP never pools merchant funds. Each tenant stores **their own** ClickPesa credentials in `PaymentProviderConfig` (one row per `(tenantId, provider)`; provider `CLICKPESA`).
- **Encrypted at rest** — `credentialsEncrypted` is AES-256-GCM JSON (`clientId`, `apiKey`, optional `checksumKey`, `webhookSecret`). Key material: env **`PAYMENTS_CREDENTIALS_SECRET`** (see `payment-credentials-crypto.ts`).
- **Masked API** — List/get config responses expose `credentialsPreview` with masked strings and booleans (`checksumKeySet`, `webhookSecretSet`), never raw secrets.
- **Truth from query/webhook** — USSD initiate / payout create responses are persisted as `rawResponse` and `lastProviderStatus` only; DB **`status`** stays **`PENDING`** until **`refresh-status`** (provider query) or **webhook** maps a terminal state. Tips follow the same rule (`COMPLETED` / `FAILED` only after txn status updates).
- **Default `orderReference`** — Auto-generated values use `tt_<tenantIdAlnumPrefix>_<col|pay|tipd>_<uuid>` for traceability; custom references must still belong to the tenant when replaying.
- **Provider HTTP** — `ClickPesaApiClient` (`CLICKPESA_API_BASE_URL`, default `https://api.clickpesa.com/third-parties`). Paths align with public docs; adjust if your merchant pack differs.

## ClickPesa tenant config model

| Field | Purpose |
|--------|---------|
| `collectionEnabled` | Allow USSD collections (including digital tips). |
| `payoutEnabled` | Allow payout preview/create. |
| `isActive` | Soft disable without delete. |
| `settings` | Optional JSON for future caps / metadata. |

## Collection flow (USSD)

1. Resolve tenant config → decrypt credentials.
2. `generateToken` (POST auth).
3. Optional **checksum** (MD5 over sorted `key=value` + `checksumKey`) when configured.
4. `previewUssdPush` → `initiateUssdPush` with **`orderReference`** unique per attempt.
5. Poll `queryPaymentByOrderReference` or accept **webhook** → map provider string → `PaymentTransactionStatus` (`COMPLETED` / `FAILED` / `PENDING`).

## Payout flow

1. Token + `previewPayout` + `createPayout` with tenant-supplied `payoutPayload` (account/MSISDN fields as required by ClickPesa).
2. Reconcile with `queryPayoutByOrderReference` or webhook.

## Digital vs cash tips

- **CASH** — `Tip` with `mode=CASH`, `status=RECORDED`; no `PaymentTransaction`.
- **DIGITAL** — `Tip` `mode=DIGITAL`, `status=PENDING` until linked `PaymentTransaction` (`type=TIP_DIGITAL`) reaches `COMPLETED` or `FAILED`. USSD initiation reuses the same path as collections; `PaymentsService.syncTipStatusFromTxn` updates tips after txn status changes.

## Webhook + reconciliation

- **Route:** `POST /api/v1/payments/webhooks/clickpesa/:tenantId` (public).
- **Verification:** If decrypted `webhookSecret` is non-empty, header **`x-tiptap-webhook-secret`** must match via **SHA-256 + `timingSafeEqual`** (`secretsEqualConstantTime` in `common/crypto/secret-compare.ts`). **Provider-signed raw body** (e.g. HMAC) is not implemented here — confirm with merchant docs and add if ClickPesa supplies a signature header.
- **Body:** Accepts `orderReference` / `order_reference`, `status` / `paymentStatus`, optional `transactionId` → updates txn + tip side effects + `AuditLog` (`actorType: WEBHOOK`).
- **`lastWebhookAt`:** On each successful webhook apply, `PaymentProviderConfig.lastWebhookAt` is set (merchant dashboard + stale-webhook heuristics).

## Phase 6 — dashboards, statements, reconciliation reads

- **Dashboard** — `GET /api/v1/payments/dashboard*` returns masked config health, paginated recent txns, and **heuristic** flags (e.g. PENDING older than 48h, failures in last 7 days, webhook idle while PENDING exist). Not a substitute for provider ledger reconciliation.
- **Statements** — `GET /api/v1/statements` / `POST /api/v1/statements/generate` compute **on-demand** totals (collections, payouts, tips, failed/refunded counts, optional branch breakdown). **`feesCents` is always null** until provider fees are modeled. **`netMovementApproxCents`** is a simple local approximation (completed collections + completed `TIP_DIGITAL` payment txns − completed payouts), **not** a statutory or bank reconciliation figure. Show the same caveats in any merchant UI.
- **Dashboard thresholds** — Stale PENDING and webhook-idle heuristics use env **`PAYMENTS_STALE_PENDING_HOURS`** (default 48) and **`PAYMENTS_WEBHOOK_STALE_HOURS`** (default 72). See `apps/api/.env.example`.
- **Reconciliation API** — `GET /api/v1/reconciliation/*` compares `lastProviderStatus` (mapped via `mapProviderStatusToTxn`) to local `status`, surfaces stale PENDING, and lists exception samples. **No** automated settlement or payout distribution.

## Legacy / other providers

- `ProviderFactoryService` + `MockPaymentProvider` remain for non-ClickPesa experiments; Phase 5 production path is ClickPesa via `PaymentsService`.

## Related code

- `apps/api/src/modules/payments/payments.service.ts`
- `apps/api/src/modules/payments/clickpesa/clickpesa-api.client.ts`
- `apps/api/src/modules/payments/clickpesa-webhook.controller.ts`
- `apps/api/src/modules/payments/payments-dashboard.service.ts`
- `apps/api/src/modules/statements/statements.service.ts`
- `apps/api/src/modules/reconciliation/reconciliation.service.ts`
- `apps/api/src/modules/tips/tips.service.ts`
