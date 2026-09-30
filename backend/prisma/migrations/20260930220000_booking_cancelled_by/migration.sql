-- Distinguish host-cancelled bookings from no-show sweep cancellations.
ALTER TABLE "Booking" ADD COLUMN "cancelledBy" TEXT;
