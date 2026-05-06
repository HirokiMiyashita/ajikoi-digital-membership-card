-- CreateTable
CREATE TABLE "member_benefit_settings" (
  "id" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "officialAccountId" TEXT,
  "signupGiftId" TEXT,
  "topRankLoopGiftId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "member_benefit_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rank_benefit_gift_settings" (
  "id" TEXT NOT NULL,
  "settingId" TEXT NOT NULL,
  "rankId" TEXT NOT NULL,
  "giftId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rank_benefit_gift_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_benefit_settings_scopeKey_key"
ON "member_benefit_settings"("scopeKey");

-- CreateIndex
CREATE INDEX "member_benefit_settings_officialAccountId_idx"
ON "member_benefit_settings"("officialAccountId");

-- CreateIndex
CREATE INDEX "member_benefit_settings_signupGiftId_idx"
ON "member_benefit_settings"("signupGiftId");

-- CreateIndex
CREATE INDEX "member_benefit_settings_topRankLoopGiftId_idx"
ON "member_benefit_settings"("topRankLoopGiftId");

-- CreateIndex
CREATE UNIQUE INDEX "rank_benefit_gift_settings_settingId_rankId_key"
ON "rank_benefit_gift_settings"("settingId", "rankId");

-- CreateIndex
CREATE INDEX "rank_benefit_gift_settings_rankId_idx"
ON "rank_benefit_gift_settings"("rankId");

-- CreateIndex
CREATE INDEX "rank_benefit_gift_settings_giftId_idx"
ON "rank_benefit_gift_settings"("giftId");

-- AddForeignKey
ALTER TABLE "member_benefit_settings"
ADD CONSTRAINT "member_benefit_settings_officialAccountId_fkey"
FOREIGN KEY ("officialAccountId") REFERENCES "official_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_benefit_settings"
ADD CONSTRAINT "member_benefit_settings_signupGiftId_fkey"
FOREIGN KEY ("signupGiftId") REFERENCES "gifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_benefit_settings"
ADD CONSTRAINT "member_benefit_settings_topRankLoopGiftId_fkey"
FOREIGN KEY ("topRankLoopGiftId") REFERENCES "gifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rank_benefit_gift_settings"
ADD CONSTRAINT "rank_benefit_gift_settings_settingId_fkey"
FOREIGN KEY ("settingId") REFERENCES "member_benefit_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rank_benefit_gift_settings"
ADD CONSTRAINT "rank_benefit_gift_settings_rankId_fkey"
FOREIGN KEY ("rankId") REFERENCES "ranks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rank_benefit_gift_settings"
ADD CONSTRAINT "rank_benefit_gift_settings_giftId_fkey"
FOREIGN KEY ("giftId") REFERENCES "gifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
