-- Add configurable late tolerance (minutes) for host "expected / late" states.
ALTER TABLE "RestaurantSettings" ADD COLUMN "lateGraceMinutes" INTEGER NOT NULL DEFAULT 15;
