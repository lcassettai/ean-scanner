-- AlterTable
ALTER TABLE "Scan" ADD COLUMN     "internalCode" TEXT,
ADD COLUMN     "price" DOUBLE PRECISION,
ADD COLUMN     "productName" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "askInternalCode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "askPrice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "askProductName" BOOLEAN NOT NULL DEFAULT false;
