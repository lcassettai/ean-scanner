-- AlterTable
ALTER TABLE "Scan" ADD COLUMN     "module" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "askModule" BOOLEAN NOT NULL DEFAULT false;
