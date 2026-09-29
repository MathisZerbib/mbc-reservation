-- AlterEnum
ALTER TYPE "TableType" ADD VALUE 'SQUARE';

-- AlterTable
ALTER TABLE "Table" ADD COLUMN     "height" DOUBLE PRECISION NOT NULL DEFAULT 60,
ADD COLUMN     "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "width" DOUBLE PRECISION NOT NULL DEFAULT 60;

-- CreateTable
CREATE TABLE "RestaurantSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "avgTicket" DOUBLE PRECISION NOT NULL DEFAULT 55,
    "floorPlanImageUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableLink" (
    "aId" INTEGER NOT NULL,
    "bId" INTEGER NOT NULL,

    CONSTRAINT "TableLink_pkey" PRIMARY KEY ("aId","bId")
);

-- AddForeignKey
ALTER TABLE "TableLink" ADD CONSTRAINT "TableLink_aId_fkey" FOREIGN KEY ("aId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableLink" ADD CONSTRAINT "TableLink_bId_fkey" FOREIGN KEY ("bId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;
