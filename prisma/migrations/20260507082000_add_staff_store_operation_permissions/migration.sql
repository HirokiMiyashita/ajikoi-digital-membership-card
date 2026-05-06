-- CreateTable
CREATE TABLE "staff_store_operation_permissions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "officialAccountId" TEXT NOT NULL,
  "canOpen" BOOLEAN NOT NULL DEFAULT false,
  "canClose" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_store_operation_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_store_operation_permissions_userId_officialAccountId_key"
ON "staff_store_operation_permissions"("userId", "officialAccountId");

-- CreateIndex
CREATE INDEX "staff_store_operation_permissions_officialAccountId_idx"
ON "staff_store_operation_permissions"("officialAccountId");

-- AddForeignKey
ALTER TABLE "staff_store_operation_permissions"
ADD CONSTRAINT "staff_store_operation_permissions_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_store_operation_permissions"
ADD CONSTRAINT "staff_store_operation_permissions_officialAccountId_fkey"
FOREIGN KEY ("officialAccountId") REFERENCES "official_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
