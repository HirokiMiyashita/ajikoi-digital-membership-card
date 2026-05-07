-- CreateIndex
CREATE INDEX "users_officialAccountId_createdAt_idx"
ON "users"("officialAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "user_checkins_officialAccountId_checkedInAt_idx"
ON "user_checkins"("officialAccountId", "checkedInAt");

-- CreateIndex
CREATE INDEX "user_checkins_officialAccountId_userId_checkedInAt_idx"
ON "user_checkins"("officialAccountId", "userId", "checkedInAt");

-- CreateIndex
CREATE INDEX "user_history_action_officialAccountId_createdAt_idx"
ON "user_history"("action", "officialAccountId", "createdAt");
