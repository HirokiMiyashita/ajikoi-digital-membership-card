ALTER TABLE "users"
ADD COLUMN "officialAccountId" TEXT,
ADD COLUMN "officialLinkedAt" TIMESTAMP(3);

ALTER TABLE "admin_user"
ADD COLUMN "officialAccountId" TEXT;

CREATE TABLE "official_accounts" (
    "id" TEXT NOT NULL,
    "lineBasicId" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "official_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "official_accounts_lineBasicId_key" ON "official_accounts"("lineBasicId");

CREATE TABLE "user_checkins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL,
    "isFirstVisit" BOOLEAN NOT NULL,
    "isRepeatVisit" BOOLEAN NOT NULL,
    "officialAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_checkins_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_checkins_userId_checkedInAt_idx" ON "user_checkins"("userId", "checkedInAt");
CREATE INDEX "user_checkins_checkedInAt_idx" ON "user_checkins"("checkedInAt");

CREATE TABLE "user_history" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "officialAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_history_targetUserId_createdAt_idx" ON "user_history"("targetUserId", "createdAt");
CREATE INDEX "user_history_action_createdAt_idx" ON "user_history"("action", "createdAt");

ALTER TABLE "users" ADD CONSTRAINT "users_officialAccountId_fkey"
FOREIGN KEY ("officialAccountId") REFERENCES "official_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "admin_user" ADD CONSTRAINT "admin_user_officialAccountId_fkey"
FOREIGN KEY ("officialAccountId") REFERENCES "official_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_checkins" ADD CONSTRAINT "user_checkins_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_checkins" ADD CONSTRAINT "user_checkins_officialAccountId_fkey"
FOREIGN KEY ("officialAccountId") REFERENCES "official_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_history" ADD CONSTRAINT "user_history_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_history" ADD CONSTRAINT "user_history_officialAccountId_fkey"
FOREIGN KEY ("officialAccountId") REFERENCES "official_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
