-- CreateEnum
CREATE TYPE "QrStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "StaffAssignmentStatus" AS ENUM ('ACTIVE', 'ENDED');

-- AlterTable
ALTER TABLE "ProviderProfile" ADD COLUMN     "skills" JSONB;

-- AlterTable
ALTER TABLE "StaffAssignment" ADD COLUMN     "status" "StaffAssignmentStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "QrCode" ADD COLUMN     "status" "QrStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "scanCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastScannedAt" TIMESTAMP(3),
ADD COLUMN     "rotatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ConversationSession" ADD COLUMN     "qrContext" JSONB,
ADD COLUMN     "clientTokenHash" TEXT,
ADD COLUMN     "lastActivityAt" TIMESTAMP(3),
ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "ConversationSession_clientTokenHash_key" ON "ConversationSession"("clientTokenHash");

-- CreateIndex
CREATE INDEX "QrCode_tenantId_status_idx" ON "QrCode"("tenantId", "status");

-- CreateIndex
CREATE INDEX "StaffAssignment_staffId_status_idx" ON "StaffAssignment"("staffId", "status");

-- CreateIndex
CREATE INDEX "ConversationSession_tenantId_expiresAt_idx" ON "ConversationSession"("tenantId", "expiresAt");

-- Backfill QrCode status from timestamps
UPDATE "QrCode" SET "status" = 'REVOKED' WHERE "revokedAt" IS NOT NULL;
UPDATE "QrCode" SET "status" = 'EXPIRED' WHERE "expiresAt" IS NOT NULL AND "expiresAt" < NOW() AND "revokedAt" IS NULL;

-- Backfill assignment status
UPDATE "StaffAssignment" SET "status" = 'ENDED' WHERE "endedAt" IS NOT NULL;
