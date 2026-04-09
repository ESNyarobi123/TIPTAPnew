-- AlterTable
ALTER TABLE "PaymentProviderConfig" ADD COLUMN "lastWebhookAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "PaymentTransaction_tenantId_type_createdAt_idx" ON "PaymentTransaction"("tenantId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Tip_tenantId_createdAt_idx" ON "Tip"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Rating_tenantId_createdAt_idx" ON "Rating"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_branchId_createdAt_idx" ON "AuditLog"("tenantId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
