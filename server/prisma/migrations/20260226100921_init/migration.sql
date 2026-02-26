-- CreateTable
CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "shortCode" TEXT NOT NULL,
    "accessCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" SERIAL NOT NULL,
    "ean" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" INTEGER NOT NULL,

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_shortCode_key" ON "Session"("shortCode");

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
