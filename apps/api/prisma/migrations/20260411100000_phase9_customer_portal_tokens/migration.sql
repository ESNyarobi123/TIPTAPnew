-- AlterTable
ALTER TABLE "DiningOrder" ADD COLUMN "portalTokenHash" TEXT,
ADD COLUMN "portalTokenCreatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "BeautyBooking" ADD COLUMN "portalTokenHash" TEXT,
ADD COLUMN "portalTokenCreatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "DiningOrder_portalTokenHash_key" ON "DiningOrder"("portalTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "BeautyBooking_portalTokenHash_key" ON "BeautyBooking"("portalTokenHash");
