CREATE TYPE "StaffCompensationType" AS ENUM ('SALARY', 'BONUS', 'COMMISSION', 'ADVANCE', 'DEDUCTION');

CREATE TYPE "StaffCompensationStatus" AS ENUM ('SCHEDULED', 'APPROVED', 'PAID', 'VOID');

CREATE TABLE "StaffCompensation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "branchId" TEXT,
  "staffId" TEXT NOT NULL,
  "type" "StaffCompensationType" NOT NULL DEFAULT 'SALARY',
  "status" "StaffCompensationStatus" NOT NULL DEFAULT 'SCHEDULED',
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "periodLabel" TEXT,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaffCompensation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffCompensation_tenantId_idx" ON "StaffCompensation"("tenantId");
CREATE INDEX "StaffCompensation_branchId_idx" ON "StaffCompensation"("branchId");
CREATE INDEX "StaffCompensation_staffId_idx" ON "StaffCompensation"("staffId");
CREATE INDEX "StaffCompensation_staffId_status_idx" ON "StaffCompensation"("staffId", "status");
CREATE INDEX "StaffCompensation_effectiveDate_idx" ON "StaffCompensation"("effectiveDate");

ALTER TABLE "StaffCompensation"
ADD CONSTRAINT "StaffCompensation_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffCompensation"
ADD CONSTRAINT "StaffCompensation_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffCompensation"
ADD CONSTRAINT "StaffCompensation_staffId_fkey"
FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
