DO $$
BEGIN
  CREATE TYPE "PayrollLineKind" AS ENUM (
    'BASIC_SALARY',
    'ALLOWANCE',
    'COMMISSION',
    'BONUS',
    'TIP_SHARE',
    'OVERTIME',
    'SERVICE_CHARGE_SHARE',
    'ADJUSTMENT',
    'ADVANCE_RECOVERY',
    'DEDUCTION'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PAID', 'RECONCILED', 'VOID');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PayrollSlipStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PAID', 'RECONCILED', 'VOID');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PayrollDisbursementMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'MANUAL_OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PayrollDisbursementStatus" AS ENUM ('PENDING', 'RECORDED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "StaffCompensation"
  ADD COLUMN IF NOT EXISTS "lineKind" "PayrollLineKind",
  ADD COLUMN IF NOT EXISTS "label" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceReference" TEXT,
  ADD COLUMN IF NOT EXISTS "payrollRunId" TEXT,
  ADD COLUMN IF NOT EXISTS "payrollSlipId" TEXT,
  ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "PayrollRun" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "branchId" TEXT,
  "status" "PayrollRunStatus" NOT NULL DEFAULT 'SUBMITTED',
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "periodLabel" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdByUserId" TEXT,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "reconciledAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PayrollSlip" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "branchId" TEXT,
  "staffId" TEXT NOT NULL,
  "payrollRunId" TEXT,
  "slipNumber" TEXT NOT NULL,
  "status" "PayrollSlipStatus" NOT NULL DEFAULT 'SUBMITTED',
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "periodLabel" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "grossCents" INTEGER NOT NULL DEFAULT 0,
  "deductionCents" INTEGER NOT NULL DEFAULT 0,
  "netCents" INTEGER NOT NULL DEFAULT 0,
  "baseSalaryCents" INTEGER NOT NULL DEFAULT 0,
  "allowanceCents" INTEGER NOT NULL DEFAULT 0,
  "commissionCents" INTEGER NOT NULL DEFAULT 0,
  "bonusCents" INTEGER NOT NULL DEFAULT 0,
  "tipShareCents" INTEGER NOT NULL DEFAULT 0,
  "overtimeCents" INTEGER NOT NULL DEFAULT 0,
  "serviceChargeCents" INTEGER NOT NULL DEFAULT 0,
  "adjustmentCents" INTEGER NOT NULL DEFAULT 0,
  "advanceRecoveryCents" INTEGER NOT NULL DEFAULT 0,
  "otherDeductionCents" INTEGER NOT NULL DEFAULT 0,
  "paidAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdByUserId" TEXT,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollSlip_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PayrollSlip_slipNumber_key" ON "PayrollSlip"("slipNumber");

CREATE TABLE IF NOT EXISTS "PayrollDisbursement" (
  "id" TEXT NOT NULL,
  "payrollSlipId" TEXT NOT NULL,
  "method" "PayrollDisbursementMethod" NOT NULL,
  "status" "PayrollDisbursementStatus" NOT NULL DEFAULT 'RECORDED',
  "amountCents" INTEGER NOT NULL,
  "reference" TEXT,
  "accountMask" TEXT,
  "recipientLabel" TEXT,
  "proofNote" TEXT,
  "externalTransactionId" TEXT,
  "metadata" JSONB,
  "recordedByUserId" TEXT,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollDisbursement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StaffCompensation_payrollRunId_idx" ON "StaffCompensation"("payrollRunId");
CREATE INDEX IF NOT EXISTS "StaffCompensation_payrollSlipId_idx" ON "StaffCompensation"("payrollSlipId");
CREATE INDEX IF NOT EXISTS "StaffCompensation_lineKind_idx" ON "StaffCompensation"("lineKind");
CREATE INDEX IF NOT EXISTS "PayrollRun_tenantId_idx" ON "PayrollRun"("tenantId");
CREATE INDEX IF NOT EXISTS "PayrollRun_branchId_idx" ON "PayrollRun"("branchId");
CREATE INDEX IF NOT EXISTS "PayrollRun_status_idx" ON "PayrollRun"("status");
CREATE INDEX IF NOT EXISTS "PayrollRun_periodStart_periodEnd_idx" ON "PayrollRun"("periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "PayrollSlip_tenantId_idx" ON "PayrollSlip"("tenantId");
CREATE INDEX IF NOT EXISTS "PayrollSlip_branchId_idx" ON "PayrollSlip"("branchId");
CREATE INDEX IF NOT EXISTS "PayrollSlip_staffId_idx" ON "PayrollSlip"("staffId");
CREATE INDEX IF NOT EXISTS "PayrollSlip_payrollRunId_idx" ON "PayrollSlip"("payrollRunId");
CREATE INDEX IF NOT EXISTS "PayrollSlip_status_idx" ON "PayrollSlip"("status");
CREATE INDEX IF NOT EXISTS "PayrollDisbursement_payrollSlipId_idx" ON "PayrollDisbursement"("payrollSlipId");
CREATE INDEX IF NOT EXISTS "PayrollDisbursement_status_idx" ON "PayrollDisbursement"("status");
CREATE INDEX IF NOT EXISTS "PayrollDisbursement_recordedAt_idx" ON "PayrollDisbursement"("recordedAt");

DO $$
BEGIN
  ALTER TABLE "StaffCompensation"
    ADD CONSTRAINT "StaffCompensation_payrollRunId_fkey"
    FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "StaffCompensation"
    ADD CONSTRAINT "StaffCompensation_payrollSlipId_fkey"
    FOREIGN KEY ("payrollSlipId") REFERENCES "PayrollSlip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "PayrollRun"
    ADD CONSTRAINT "PayrollRun_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "PayrollRun"
    ADD CONSTRAINT "PayrollRun_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "PayrollSlip"
    ADD CONSTRAINT "PayrollSlip_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "PayrollSlip"
    ADD CONSTRAINT "PayrollSlip_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "PayrollSlip"
    ADD CONSTRAINT "PayrollSlip_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "PayrollSlip"
    ADD CONSTRAINT "PayrollSlip_payrollRunId_fkey"
    FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "PayrollDisbursement"
    ADD CONSTRAINT "PayrollDisbursement_payrollSlipId_fkey"
    FOREIGN KEY ("payrollSlipId") REFERENCES "PayrollSlip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
