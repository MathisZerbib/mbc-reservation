-- faci-table fail-safe holds: typed DepositStatus (+EXPIRED), informational
-- expiry timestamp, webhook idempotency ledger, hold lookup indexes.
-- No data rewrite beyond casting the existing TEXT values into the enum —
-- every legacy value (NONE|PENDING|HELD|CAPTURED|RELEASED|FAILED) is valid.

-- Residue guard: earlier failed attempts (PG 42804/42601) left the enum type
-- behind without converting the column. Drop it so this migration is clean.
DROP TYPE IF EXISTS "DepositStatus";
CREATE TYPE "DepositStatus" AS ENUM ('NONE', 'PENDING', 'HELD', 'CAPTURED', 'RELEASED', 'EXPIRED', 'FAILED');

ALTER TABLE "Booking" ALTER COLUMN "depositStatus" DROP DEFAULT;
ALTER TABLE "Booking" ALTER COLUMN "depositStatus" TYPE "DepositStatus" USING "depositStatus"::"DepositStatus";
ALTER TABLE "Booking" ALTER COLUMN "depositStatus" SET DEFAULT 'NONE';
ALTER TABLE "Booking" ADD COLUMN "depositExpiresAt" TIMESTAMP(3);

CREATE INDEX "Booking_tenantId_depositStatus_startTime_idx"
  ON "Booking"("tenantId", "depositStatus", "startTime");
CREATE INDEX "Booking_stripePaymentIntentId_idx"
  ON "Booking"("stripePaymentIntentId");

-- Single platform Connect webhook: Stripe redelivers aggressively, so the
-- handler inserts the event id first and short-circuits on conflict.
CREATE TABLE "StripeWebhookEvent" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "stripeAccountId" TEXT,
  "type" TEXT NOT NULL,
  "bookingId" TEXT,
  "outcome" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StripeWebhookEvent_eventId_key" ON "StripeWebhookEvent"("eventId");
CREATE INDEX "StripeWebhookEvent_stripeAccountId_idx" ON "StripeWebhookEvent"("stripeAccountId");
