-- Optional per-tag details captured at booking creation (all nullable/blankable).
ALTER TABLE "Booking" ADD COLUMN "allergyNote" TEXT;
ALTER TABLE "Booking" ADD COLUMN "birthdayDate" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "vipNote" TEXT;
