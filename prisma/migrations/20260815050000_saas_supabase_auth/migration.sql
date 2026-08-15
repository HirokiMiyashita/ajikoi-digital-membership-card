-- Add SaaS tenant settings.
ALTER TABLE "official_accounts"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "logoUrl" TEXT,
  ADD COLUMN "themeColor" TEXT NOT NULL DEFAULT '#0f766e',
  ADD COLUMN "liffId" TEXT,
  ADD COLUMN "lineAddFriendUrl" TEXT,
  ADD COLUMN "lineChannelAccessToken" TEXT,
  ADD COLUMN "visitQrToken" TEXT,
  ADD COLUMN "googleReviewUrl" TEXT,
  ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

UPDATE "official_accounts"
SET
  "slug" = CASE
    WHEN "lineBasicId" IN ('@local-dev', '@607wzgdz') THEN 'ajikoi'
    ELSE 'store-' || substr("id", 1, 8)
  END,
  "displayName" = COALESCE(NULLIF("name", ''), "lineBasicId"),
  "onboardingCompletedAt" = NOW();

ALTER TABLE "official_accounts" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "official_accounts_slug_key" ON "official_accounts"("slug");
CREATE INDEX "official_accounts_liffId_idx" ON "official_accounts"("liffId");

-- Scope gifts to a tenant. Existing gifts belong to the first existing tenant.
ALTER TABLE "gifts" ADD COLUMN "officialAccountId" TEXT;
UPDATE "gifts"
SET "officialAccountId" = (
  SELECT "id"
  FROM "official_accounts"
  ORDER BY CASE WHEN "slug" = 'ajikoi' THEN 0 ELSE 1 END, "createdAt"
  LIMIT 1
);
DELETE FROM "gifts" WHERE "officialAccountId" IS NULL;
ALTER TABLE "gifts" ALTER COLUMN "officialAccountId" SET NOT NULL;
ALTER TABLE "gifts"
  ADD CONSTRAINT "gifts_officialAccountId_fkey"
  FOREIGN KEY ("officialAccountId") REFERENCES "official_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "gifts_officialAccountId_idx" ON "gifts"("officialAccountId");

-- Admin users are Supabase Auth identities.
ALTER TABLE "admin_user"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "avatarUrl" TEXT,
  ALTER COLUMN "passwordHash" DROP NOT NULL;
CREATE UNIQUE INDEX "admin_user_email_key" ON "admin_user"("email");
CREATE UNIQUE INDEX "admin_user_officialAccountId_key" ON "admin_user"("officialAccountId");

DROP TABLE IF EXISTS "admin_auth_verification";
DROP TABLE IF EXISTS "admin_auth_account";
DROP TABLE IF EXISTS "admin_auth_session";
DROP TABLE IF EXISTS "admin_auth_user";
