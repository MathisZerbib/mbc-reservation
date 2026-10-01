-- Booking origin (walk-in vs reservation), real turnover (leftAt), per-service tickets.
CREATE TYPE "BookingSource" AS ENUM ('RESERVATION', 'WALKIN');
ALTER TABLE "Booking" ADD COLUMN "source" "BookingSource" NOT NULL DEFAULT 'RESERVATION';
ALTER TABLE "Booking" ADD COLUMN "leftAt" TIMESTAMP(3);
ALTER TABLE "RestaurantSettings" ADD COLUMN "avgTicketLunch" DOUBLE PRECISION;
ALTER TABLE "RestaurantSettings" ADD COLUMN "avgTicketDinner" DOUBLE PRECISION;
