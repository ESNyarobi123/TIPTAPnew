-- CreateEnum (required by StaffJoinInvite.mode and StaffAssignment.mode in schema)
CREATE TYPE "StaffAssignmentMode" AS ENUM ('PART_TIME_SHARED', 'FULL_TIME_EXCLUSIVE', 'TEMPORARY_CONTRACT', 'SHIFT_BASED');

-- AlterTable: StaffAssignment.mode exists in Prisma schema but was never migrated
ALTER TABLE "StaffAssignment" ADD COLUMN IF NOT EXISTS "mode" "StaffAssignmentMode" NOT NULL DEFAULT 'PART_TIME_SHARED';

-- CreateTable
CREATE TABLE "StaffJoinInvite" (
    "id" TEXT NOT NULL,
    "codeNormalized" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "roleInTenant" "RoleCode" NOT NULL DEFAULT 'SERVICE_STAFF',
    "mode" "StaffAssignmentMode" NOT NULL DEFAULT 'PART_TIME_SHARED',
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usesCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffJoinInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffJoinInvite_codeNormalized_key" ON "StaffJoinInvite"("codeNormalized");

-- CreateIndex
CREATE INDEX "StaffJoinInvite_tenantId_idx" ON "StaffJoinInvite"("tenantId");

-- CreateIndex
CREATE INDEX "StaffJoinInvite_branchId_idx" ON "StaffJoinInvite"("branchId");

-- AddForeignKey
ALTER TABLE "StaffJoinInvite" ADD CONSTRAINT "StaffJoinInvite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffJoinInvite" ADD CONSTRAINT "StaffJoinInvite_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
