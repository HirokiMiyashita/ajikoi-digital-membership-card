-- Update rank thresholds to match product spec:
-- レギュラー(0-2), シルバー(3-9), ゴールド(10-29), プラチナ(30-49), ダイヤモンド(50+)

INSERT INTO "ranks" ("id", "name", "minPoints", "maxPoints")
VALUES
  ('regular', 'レギュラー', 0, 2),
  ('silver', 'シルバー', 3, 9),
  ('gold', 'ゴールド', 10, 29),
  ('platinum', 'プラチナ', 30, 49),
  ('diamond', 'ダイヤモンド', 50, 2147483647)
ON CONFLICT ("id")
DO UPDATE SET
  "name" = EXCLUDED."name",
  "minPoints" = EXCLUDED."minPoints",
  "maxPoints" = EXCLUDED."maxPoints";

UPDATE "users" AS u
SET "nextRank" = r."id"
FROM "ranks" AS r
WHERE u."points" BETWEEN r."minPoints" AND r."maxPoints"
  AND u."nextRank" <> r."id";
