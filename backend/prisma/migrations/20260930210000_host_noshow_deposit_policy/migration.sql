-- Host no-show policy (auto-cancel toggle) and card-hold policy (enabled + size threshold).
ALTER TABLE "RestaurantSettings" ADD COLUMN "autoCancelLate" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RestaurantSettings" ADD COLUMN "depositEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RestaurantSettings" ADD COLUMN "depositMinSize" INTEGER NOT NULL DEFAULT 6;
