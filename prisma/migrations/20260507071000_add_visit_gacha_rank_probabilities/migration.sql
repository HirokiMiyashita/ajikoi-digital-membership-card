CREATE TABLE "visit_gacha_rank_probabilities" (
    "id" TEXT NOT NULL,
    "settingId" TEXT NOT NULL,
    "rankId" TEXT NOT NULL,
    "winProbability" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_gacha_rank_probabilities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "visit_gacha_rank_probabilities_settingId_rankId_key"
ON "visit_gacha_rank_probabilities"("settingId", "rankId");

CREATE INDEX "visit_gacha_rank_probabilities_rankId_idx"
ON "visit_gacha_rank_probabilities"("rankId");

ALTER TABLE "visit_gacha_rank_probabilities"
ADD CONSTRAINT "visit_gacha_rank_probabilities_settingId_fkey"
FOREIGN KEY ("settingId") REFERENCES "visit_gacha_settings"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "visit_gacha_rank_probabilities"
ADD CONSTRAINT "visit_gacha_rank_probabilities_rankId_fkey"
FOREIGN KEY ("rankId") REFERENCES "ranks"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
