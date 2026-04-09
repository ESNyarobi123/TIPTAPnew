-- Phase 7: DiningOrder + BeautyBooking core

-- CreateEnum
CREATE TYPE "DiningOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DiningOrderItemStatus" AS ENUM ('PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BeautyBookingStatus" AS ENUM ('BOOKED', 'CONFIRMED', 'CHECKED_IN', 'IN_SERVICE', 'COMPLETED', 'PAID', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "BeautyBookingServiceStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "nextDiningOrderSeq" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Branch" ADD COLUMN     "nextBeautyBookingSeq" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DiningOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "diningTableId" TEXT,
    "staffId" TEXT,
    "sessionId" TEXT,
    "customerPhone" TEXT,
    "orderNumber" TEXT NOT NULL,
    "status" "DiningOrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "paymentMethod" TEXT,
    "paidAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DiningOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiningOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL,
    "totalPriceCents" INTEGER NOT NULL,
    "status" "DiningOrderItemStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "modifiers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiningOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeautyBooking" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "stationId" TEXT,
    "staffId" TEXT,
    "sessionId" TEXT,
    "customerPhone" TEXT,
    "customerName" TEXT,
    "bookingNumber" TEXT NOT NULL,
    "status" "BeautyBookingStatus" NOT NULL DEFAULT 'BOOKED',
    "scheduledAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "isWalkIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BeautyBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeautyBookingService" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "beautyServiceId" TEXT NOT NULL,
    "staffId" TEXT,
    "durationMin" INTEGER,
    "priceCents" INTEGER NOT NULL,
    "status" "BeautyBookingServiceStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeautyBookingService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiningOrder_branchId_orderNumber_key" ON "DiningOrder"("branchId", "orderNumber");

-- CreateIndex
CREATE INDEX "DiningOrder_tenantId_branchId_status_idx" ON "DiningOrder"("tenantId", "branchId", "status");

-- CreateIndex
CREATE INDEX "DiningOrder_tenantId_branchId_createdAt_idx" ON "DiningOrder"("tenantId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "DiningOrder_sessionId_idx" ON "DiningOrder"("sessionId");

-- CreateIndex
CREATE INDEX "DiningOrderItem_orderId_idx" ON "DiningOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "DiningOrderItem_menuItemId_idx" ON "DiningOrderItem"("menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "BeautyBooking_branchId_bookingNumber_key" ON "BeautyBooking"("branchId", "bookingNumber");

-- CreateIndex
CREATE INDEX "BeautyBooking_tenantId_branchId_status_idx" ON "BeautyBooking"("tenantId", "branchId", "status");

-- CreateIndex
CREATE INDEX "BeautyBooking_tenantId_branchId_scheduledAt_idx" ON "BeautyBooking"("tenantId", "branchId", "scheduledAt");

-- CreateIndex
CREATE INDEX "BeautyBooking_sessionId_idx" ON "BeautyBooking"("sessionId");

-- CreateIndex
CREATE INDEX "BeautyBookingService_bookingId_idx" ON "BeautyBookingService"("bookingId");

-- CreateIndex
CREATE INDEX "BeautyBookingService_beautyServiceId_idx" ON "BeautyBookingService"("beautyServiceId");

-- CreateIndex
CREATE INDEX "BeautyBookingService_staffId_idx" ON "BeautyBookingService"("staffId");

-- AddForeignKey
ALTER TABLE "DiningOrder" ADD CONSTRAINT "DiningOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningOrder" ADD CONSTRAINT "DiningOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningOrder" ADD CONSTRAINT "DiningOrder_diningTableId_fkey" FOREIGN KEY ("diningTableId") REFERENCES "DiningTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningOrder" ADD CONSTRAINT "DiningOrder_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConversationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningOrder" ADD CONSTRAINT "DiningOrder_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningOrder" ADD CONSTRAINT "DiningOrder_claimedByStaffId_fkey" FOREIGN KEY ("claimedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningOrderItem" ADD CONSTRAINT "DiningOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DiningOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningOrderItem" ADD CONSTRAINT "DiningOrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "DiningMenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeautyBooking" ADD CONSTRAINT "BeautyBooking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeautyBooking" ADD CONSTRAINT "BeautyBooking_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeautyBooking" ADD CONSTRAINT "BeautyBooking_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "BeautyStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeautyBooking" ADD CONSTRAINT "BeautyBooking_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConversationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeautyBooking" ADD CONSTRAINT "BeautyBooking_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeautyBookingService" ADD CONSTRAINT "BeautyBookingService_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "BeautyBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeautyBookingService" ADD CONSTRAINT "BeautyBookingService_beautyServiceId_fkey" FOREIGN KEY ("beautyServiceId") REFERENCES "BeautyService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeautyBookingService" ADD CONSTRAINT "BeautyBookingService_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
