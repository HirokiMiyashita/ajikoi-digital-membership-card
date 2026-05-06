CREATE TYPE "GiftExpiryType" AS ENUM ('DAYS_AFTER_ISSUE', 'FIXED_DATE');

CREATE TABLE "gifts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "usageGuide" TEXT NOT NULL,
    "expiryType" "GiftExpiryType" NOT NULL,
    "expiryDays" INTEGER,
    "expiryAt" TIMESTAMP(3),
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gifts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_gifts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "giftId" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "transferredFromId" TEXT,
    "transferredToUserId" TEXT,
    "transferredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_gifts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_gifts_userId_isUsed_idx" ON "user_gifts"("userId", "isUsed");
CREATE INDEX "user_gifts_giftId_idx" ON "user_gifts"("giftId");
CREATE INDEX "user_gifts_expiresAt_idx" ON "user_gifts"("expiresAt");

ALTER TABLE "user_gifts" ADD CONSTRAINT "user_gifts_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_gifts" ADD CONSTRAINT "user_gifts_giftId_fkey"
FOREIGN KEY ("giftId") REFERENCES "gifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_gifts" ADD CONSTRAINT "user_gifts_transferredFromId_fkey"
FOREIGN KEY ("transferredFromId") REFERENCES "user_gifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
