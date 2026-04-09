-- Optional FK from Tip to DiningOrder / BeautyBooking (conversation or dashboard tips).

ALTER TABLE "Tip" ADD COLUMN "diningOrderId" TEXT;

ALTER TABLE "Tip" ADD COLUMN "beautyBookingId" TEXT;

CREATE INDEX "Tip_diningOrderId_idx" ON "Tip"("diningOrderId");

CREATE INDEX "Tip_beautyBookingId_idx" ON "Tip"("beautyBookingId");

ALTER TABLE "Tip" ADD CONSTRAINT "Tip_diningOrderId_fkey" FOREIGN KEY ("diningOrderId") REFERENCES "DiningOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Tip" ADD CONSTRAINT "Tip_beautyBookingId_fkey" FOREIGN KEY ("beautyBookingId") REFERENCES "BeautyBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
