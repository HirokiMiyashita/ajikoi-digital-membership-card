ALTER TABLE "users"
ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "users_officialAccountId_isTest_role_idx"
ON "users"("officialAccountId", "isTest", "role");
