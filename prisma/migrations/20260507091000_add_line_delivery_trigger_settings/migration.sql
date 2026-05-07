-- CreateEnum
CREATE TYPE "LineDeliveryTriggerType" AS ENUM ('USER_SIGNUP', 'CHECKIN_POINT_GRANTED', 'RANK_UP');

-- CreateTable
CREATE TABLE "line_delivery_trigger_settings" (
  "id" TEXT NOT NULL,
  "officialAccountId" TEXT,
  "title" TEXT NOT NULL,
  "triggerType" "LineDeliveryTriggerType" NOT NULL,
  "message" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "line_delivery_trigger_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "line_delivery_trigger_settings_officialAccountId_idx"
ON "line_delivery_trigger_settings"("officialAccountId");

-- CreateIndex
CREATE INDEX "line_delivery_trigger_settings_triggerType_idx"
ON "line_delivery_trigger_settings"("triggerType");

-- AddForeignKey
ALTER TABLE "line_delivery_trigger_settings"
ADD CONSTRAINT "line_delivery_trigger_settings_officialAccountId_fkey"
FOREIGN KEY ("officialAccountId") REFERENCES "official_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
