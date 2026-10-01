-- Soft-delete (GDPR erasure) + configurable PII retention.
ALTER TABLE "Booking" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "RestaurantSettings" ADD COLUMN "retentionMonths" INTEGER NOT NULL DEFAULT 13;
