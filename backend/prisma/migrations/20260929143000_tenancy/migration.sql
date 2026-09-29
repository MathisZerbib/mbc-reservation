-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'STAFF');

-- DropIndex (name becomes unique per tenant below)
DROP INDEX "Table_name_key";

-- CreateTable Tenant
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "trialEndsAt" TIMESTAMP(3) NOT NULL,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- AlterTable: add nullable tenant columns first (backfilled below)
ALTER TABLE "Booking" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Table" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerified" TIMESTAMP(3),
ADD COLUMN "role" "Role" NOT NULL DEFAULT 'OWNER',
ADD COLUMN "tenantId" TEXT;
CREATE SEQUENCE restaurantsettings_id_seq;
ALTER TABLE "RestaurantSettings" ADD COLUMN "tenantId" TEXT,
ALTER COLUMN "id" SET DEFAULT nextval('restaurantsettings_id_seq');
ALTER SEQUENCE restaurantsettings_id_seq OWNED BY "RestaurantSettings"."id";

-- Backfill: default tenant owns all pre-tenancy rows.
-- Fixed id keeps the migration re-runnable in principle and traceable.
INSERT INTO "Tenant" ("id", "name", "slug", "trialEndsAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001', 'MBC', 'mbc', NOW() + INTERVAL '365 days', NOW())
ON CONFLICT ("id") DO NOTHING;

UPDATE "Booking" SET "tenantId" = '00000000-0000-0000-0000-000000000001' WHERE "tenantId" IS NULL;
UPDATE "Table" SET "tenantId" = '00000000-0000-0000-0000-000000000001' WHERE "tenantId" IS NULL;
UPDATE "User" SET "tenantId" = '00000000-0000-0000-0000-000000000001' WHERE "tenantId" IS NULL;
UPDATE "RestaurantSettings" SET "tenantId" = '00000000-0000-0000-0000-000000000001' WHERE "tenantId" IS NULL;

-- Sequence must resume past the legacy id=1 row.
SELECT setval('restaurantsettings_id_seq', (SELECT MAX("id") FROM "RestaurantSettings"));

-- Enforce NOT NULL + constraints after backfill
ALTER TABLE "Booking" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Table" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "RestaurantSettings" ALTER COLUMN "tenantId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantSettings_tenantId_key" ON "RestaurantSettings"("tenantId");
CREATE UNIQUE INDEX "Table_tenantId_name_key" ON "Table"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Table" ADD CONSTRAINT "Table_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantSettings" ADD CONSTRAINT "RestaurantSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
