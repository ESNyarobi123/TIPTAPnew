-- Align operational enums: PENDING → ACKNOWLEDGED → RESOLVED / CANCELLED

-- WaiterCallStatus
ALTER TYPE "WaiterCallStatus" RENAME VALUE 'OPEN' TO 'PENDING';
ALTER TYPE "WaiterCallStatus" RENAME VALUE 'CLOSED' TO 'RESOLVED';

-- BillRequestStatus (rename existing labels — no new enum members in this transaction)
ALTER TYPE "BillRequestStatus" RENAME VALUE 'SERVED' TO 'ACKNOWLEDGED';
ALTER TYPE "BillRequestStatus" RENAME VALUE 'PAID' TO 'RESOLVED';

-- AssistanceRequestStatus
ALTER TYPE "AssistanceRequestStatus" RENAME VALUE 'OPEN' TO 'PENDING';
ALTER TYPE "AssistanceRequestStatus" RENAME VALUE 'IN_PROGRESS' TO 'ACKNOWLEDGED';
ALTER TYPE "AssistanceRequestStatus" RENAME VALUE 'CLOSED' TO 'CANCELLED';

-- BeautyStation
CREATE TYPE "BeautyStationStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE');
ALTER TABLE "BeautyStation" ADD COLUMN "status" "BeautyStationStatus" NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "BeautyStation" ADD COLUMN "notes" TEXT;

-- BeautyService
ALTER TABLE "BeautyService" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "BeautyService" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

-- ProviderSpecialization (optional links to catalog)
ALTER TABLE "ProviderSpecialization" ADD COLUMN "beautyServiceCategoryId" TEXT;
ALTER TABLE "ProviderSpecialization" ADD COLUMN "beautyServiceId" TEXT;

-- AssistanceRequest optional targeted staff
ALTER TABLE "AssistanceRequest" ADD COLUMN "staffId" TEXT;

CREATE INDEX "AssistanceRequest_staffId_idx" ON "AssistanceRequest"("staffId");

CREATE INDEX "ProviderSpecialization_beautyServiceCategoryId_idx" ON "ProviderSpecialization"("beautyServiceCategoryId");
CREATE INDEX "ProviderSpecialization_beautyServiceId_idx" ON "ProviderSpecialization"("beautyServiceId");

ALTER TABLE "ProviderSpecialization" ADD CONSTRAINT "ProviderSpecialization_beautyServiceCategoryId_fkey" FOREIGN KEY ("beautyServiceCategoryId") REFERENCES "BeautyServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderSpecialization" ADD CONSTRAINT "ProviderSpecialization_beautyServiceId_fkey" FOREIGN KEY ("beautyServiceId") REFERENCES "BeautyService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssistanceRequest" ADD CONSTRAINT "AssistanceRequest_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
