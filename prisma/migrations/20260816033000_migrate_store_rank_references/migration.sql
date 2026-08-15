UPDATE "line_delivery_trigger_settings" trigger
SET "targetRankIds" = ARRAY(
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM "ranks" target
      WHERE target."id" = md5(
        trigger."officialAccountId" || ':rank:' || source_rank_id
      )
    )
    THEN md5(trigger."officialAccountId" || ':rank:' || source_rank_id)
    ELSE source_rank_id
  END
  FROM unnest(trigger."targetRankIds") AS source_rank_id
)
WHERE trigger."officialAccountId" IS NOT NULL
  AND cardinality(trigger."targetRankIds") > 0;

UPDATE "user_history" history
SET "metadata" = jsonb_set(
  history."metadata"::jsonb,
  '{rankId}',
  to_jsonb(
    md5(
      history."officialAccountId" || ':rank:' || (history."metadata"::jsonb ->> 'rankId')
    )
  ),
  false
)
WHERE history."officialAccountId" IS NOT NULL
  AND history."metadata" IS NOT NULL
  AND history."metadata"::jsonb ? 'rankId'
  AND EXISTS (
    SELECT 1
    FROM "ranks" target
    WHERE target."id" = md5(
      history."officialAccountId" || ':rank:' || (history."metadata"::jsonb ->> 'rankId')
    )
  );
