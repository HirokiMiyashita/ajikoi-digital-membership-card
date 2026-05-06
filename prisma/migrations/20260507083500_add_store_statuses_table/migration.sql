-- CreateTable
CREATE TABLE "store_statuses" (
  "id" TEXT NOT NULL,
  "officialAccountId" TEXT NOT NULL,
  "isOpen" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "store_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_statuses_officialAccountId_key"
ON "store_statuses"("officialAccountId");

-- CreateIndex
CREATE INDEX "store_statuses_officialAccountId_idx"
ON "store_statuses"("officialAccountId");

-- AddForeignKey
ALTER TABLE "store_statuses"
ADD CONSTRAINT "store_statuses_officialAccountId_fkey"
FOREIGN KEY ("officialAccountId") REFERENCES "official_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
