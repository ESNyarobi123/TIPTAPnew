-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN "lastUsedAt" TIMESTAMP(3),
ADD COLUMN "userAgent" TEXT,
ADD COLUMN "ipAddress" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "legalName" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "phone" TEXT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "actorType" TEXT NOT NULL DEFAULT 'USER',
ADD COLUMN "correlationId" TEXT,
ADD COLUMN "summary" TEXT,
ADD COLUMN "details" JSONB;

CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");
