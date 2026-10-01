-- Stripe Connect Express: one account per restaurant for direct charges.
ALTER TABLE "RestaurantSettings" ADD COLUMN "stripeAccountId" TEXT;
ALTER TABLE "RestaurantSettings" ADD COLUMN "stripeOnboarded" BOOLEAN NOT NULL DEFAULT false;
