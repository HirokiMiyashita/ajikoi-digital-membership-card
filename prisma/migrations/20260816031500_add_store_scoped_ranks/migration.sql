ALTER TABLE "ranks"
ADD COLUMN "officialAccountId" TEXT,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

INSERT INTO "ranks" (
  "id",
  "officialAccountId",
  "name",
  "minPoints",
  "maxPoints",
  "sortOrder",
  "isActive"
)
SELECT
  md5(oa."id" || ':rank:' || source."id"),
  oa."id",
  source."name",
  source."minPoints",
  source."maxPoints",
  ROW_NUMBER() OVER (
    PARTITION BY oa."id"
    ORDER BY source."minPoints", source."id"
  )::integer - 1,
  true
FROM "official_accounts" oa
CROSS JOIN "ranks" source
WHERE source."officialAccountId" IS NULL;

UPDATE "users" u
SET "nextRank" = md5(u."officialAccountId" || ':rank:' || u."nextRank")
WHERE u."officialAccountId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "ranks" target
    WHERE target."id" = md5(u."officialAccountId" || ':rank:' || u."nextRank")
  );

UPDATE "rank_benefit_gift_settings" rb
SET "rankId" = md5(mb."officialAccountId" || ':rank:' || rb."rankId")
FROM "member_benefit_settings" mb
WHERE mb."id" = rb."settingId"
  AND mb."officialAccountId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "ranks" target
    WHERE target."id" = md5(mb."officialAccountId" || ':rank:' || rb."rankId")
  );

UPDATE "visit_gacha_rank_probabilities" probability
SET "rankId" = md5(setting."officialAccountId" || ':rank:' || probability."rankId")
FROM "visit_gacha_settings" setting
WHERE setting."id" = probability."settingId"
  AND setting."officialAccountId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "ranks" target
    WHERE target."id" = md5(setting."officialAccountId" || ':rank:' || probability."rankId")
  );

ALTER TABLE "ranks"
ADD CONSTRAINT "ranks_officialAccountId_fkey"
FOREIGN KEY ("officialAccountId")
REFERENCES "official_accounts"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ranks_officialAccountId_sortOrder_key"
ON "ranks"("officialAccountId", "sortOrder");

CREATE INDEX "ranks_officialAccountId_minPoints_idx"
ON "ranks"("officialAccountId", "minPoints");
