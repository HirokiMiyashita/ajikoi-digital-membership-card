CREATE TABLE "visit_gacha_settings" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "officialAccountId" TEXT,
    "giftId" TEXT NOT NULL,
    "winProbability" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_gacha_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "visit_gacha_settings_scopeKey_key" ON "visit_gacha_settings"("scopeKey");
CREATE INDEX "visit_gacha_settings_officialAccountId_idx" ON "visit_gacha_settings"("officialAccountId");
CREATE INDEX "visit_gacha_settings_giftId_idx" ON "visit_gacha_settings"("giftId");

ALTER TABLE "visit_gacha_settings"
ADD CONSTRAINT "visit_gacha_settings_officialAccountId_fkey"
FOREIGN KEY ("officialAccountId") REFERENCES "official_accounts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "visit_gacha_settings"
ADD CONSTRAINT "visit_gacha_settings_giftId_fkey"
FOREIGN KEY ("giftId") REFERENCES "gifts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
