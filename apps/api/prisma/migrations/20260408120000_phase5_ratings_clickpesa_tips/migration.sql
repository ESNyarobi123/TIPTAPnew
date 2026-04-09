-- Phase 5: ratings fields, ClickPesa-ready payments, tip modes, transaction typing.

CREATE TYPE "PaymentTransactionType" AS ENUM ('COLLECTION', 'PAYOUT', 'TIP_DIGITAL');

CREATE TYPE "TipMode" AS ENUM ('CASH', 'DIGITAL');

ALTER TYPE "TipStatus" ADD VALUE IF NOT EXISTS 'RECORDED';

ALTER TYPE "PaymentProviderKey" ADD VALUE IF NOT EXISTS 'CLICKPESA';

ALTER TABLE "PaymentProviderConfig" ADD COLUMN IF NOT EXISTS "collectionEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PaymentProviderConfig" ADD COLUMN IF NOT EXISTS "payoutEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentProviderConfig_tenantId_provider_key" ON "PaymentProviderConfig"("tenantId", "provider");

ALTER TABLE "Tip" ADD COLUMN IF NOT EXISTS "mode" "TipMode" NOT NULL DEFAULT 'DIGITAL';

ALTER TABLE "Rating" ADD COLUMN IF NOT EXISTS "vertical" "BusinessCategory";
ALTER TABLE "Rating" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;
ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "type" "PaymentTransactionType" NOT NULL DEFAULT 'COLLECTION';
ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "orderReference" TEXT;
ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "rawRequest" JSONB;
ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "rawResponse" JSONB;
ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "lastProviderStatus" TEXT;

UPDATE "PaymentTransaction" SET "orderReference" = "id" WHERE "orderReference" IS NULL;

ALTER TABLE "PaymentTransaction" ALTER COLUMN "orderReference" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentTransaction_orderReference_key" ON "PaymentTransaction"("orderReference");

CREATE INDEX IF NOT EXISTS "PaymentTransaction_sessionId_idx" ON "PaymentTransaction"("sessionId");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_branchId_idx" ON "PaymentTransaction"("branchId");
CREATE INDEX IF NOT EXISTS "Rating_sessionId_targetType_targetId_idx" ON "Rating"("sessionId", "targetType", "targetId");

DO $$ BEGIN
 ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
 ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConversationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "rating_session_target_active_uidx" ON "Rating" ("sessionId", "targetType", "targetId") WHERE "sessionId" IS NOT NULL AND "deletedAt" IS NULL;
