-- AlterTable
ALTER TABLE "member_benefit_settings" ADD COLUMN "reviewGiftId" TEXT;

-- CreateIndex
CREATE INDEX "member_benefit_settings_reviewGiftId_idx" ON "member_benefit_settings"("reviewGiftId");

-- AddForeignKey
ALTER TABLE "member_benefit_settings"
ADD CONSTRAINT "member_benefit_settings_reviewGiftId_fkey"
FOREIGN KEY ("reviewGiftId") REFERENCES "gifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
