-- CreateEnum
CREATE TYPE "DiningTableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE');

-- AlterEnum
ALTER TYPE "WaiterCallStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "DiningMenuItem" ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "modifierSchema" JSONB;

-- AlterTable
ALTER TABLE "DiningTable" ADD COLUMN     "status" "DiningTableStatus" NOT NULL DEFAULT 'AVAILABLE';

-- AlterTable
ALTER TABLE "WaiterCallRequest" ADD COLUMN     "staffId" TEXT;

-- CreateIndex
CREATE INDEX "WaiterCallRequest_staffId_idx" ON "WaiterCallRequest"("staffId");

-- AddForeignKey
ALTER TABLE "WaiterCallRequest" ADD CONSTRAINT "WaiterCallRequest_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
