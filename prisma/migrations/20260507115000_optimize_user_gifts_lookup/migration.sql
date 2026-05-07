-- CreateIndex
CREATE INDEX "user_gifts_userId_isUsed_expiresAt_issuedAt_createdAt_idx"
ON "user_gifts"("userId", "isUsed", "expiresAt", "issuedAt" DESC, "createdAt" DESC);
