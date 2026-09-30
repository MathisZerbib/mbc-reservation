-- Host service pilotage: booking tags, guest confirmation, seating time,
-- and per-tenant table turnover expectation.
ALTER TABLE "Booking" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Booking" ADD COLUMN "guestConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN "seatedAt" TIMESTAMP(3);
ALTER TABLE "RestaurantSettings" ADD COLUMN "tableTurnoverMinutes" INTEGER NOT NULL DEFAULT 105;
