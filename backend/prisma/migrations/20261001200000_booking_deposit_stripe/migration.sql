-- Stripe deposit holds: per-booking hold state + fixed amount setting.
ALTER TABLE "Booking" ADD COLUMN "depositStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Booking" ADD COLUMN "depositAmountCents" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "stripePaymentIntentId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "stripeCheckoutSessionId" TEXT;
ALTER TABLE "RestaurantSettings" ADD COLUMN "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 20;
