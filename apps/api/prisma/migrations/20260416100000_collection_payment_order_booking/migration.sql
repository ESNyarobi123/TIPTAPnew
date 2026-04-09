-- Link COLLECTION PaymentTransaction to DiningOrder / BeautyBooking; beauty paidAt for settlement timestamps.

ALTER TABLE "BeautyBooking" ADD COLUMN "paidAt" TIMESTAMP(3);

ALTER TABLE "DiningOrder" ADD COLUMN "collectionPaymentId" TEXT;

ALTER TABLE "BeautyBooking" ADD COLUMN "collectionPaymentId" TEXT;

CREATE UNIQUE INDEX "DiningOrder_collectionPaymentId_key" ON "DiningOrder"("collectionPaymentId");

CREATE UNIQUE INDEX "BeautyBooking_collectionPaymentId_key" ON "BeautyBooking"("collectionPaymentId");

ALTER TABLE "DiningOrder" ADD CONSTRAINT "DiningOrder_collectionPaymentId_fkey" FOREIGN KEY ("collectionPaymentId") REFERENCES "PaymentTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BeautyBooking" ADD CONSTRAINT "BeautyBooking_collectionPaymentId_fkey" FOREIGN KEY ("collectionPaymentId") REFERENCES "PaymentTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
