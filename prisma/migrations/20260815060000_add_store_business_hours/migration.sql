CREATE TYPE "BusinessHourDay" AS ENUM (
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
  'HOLIDAY'
);

CREATE TABLE "store_business_hours" (
  "id" TEXT NOT NULL,
  "officialAccountId" TEXT NOT NULL,
  "day" "BusinessHourDay" NOT NULL,
  "isClosed" BOOLEAN NOT NULL DEFAULT false,
  "openingMinute" INTEGER,
  "closingMinute" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "store_business_hours_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "store_business_hours_minute_range_check"
    CHECK (
      ("isClosed" = true AND "openingMinute" IS NULL AND "closingMinute" IS NULL)
      OR
      (
        "isClosed" = false
        AND "openingMinute" BETWEEN 0 AND 1439
        AND "closingMinute" BETWEEN 0 AND 1439
        AND "openingMinute" <> "closingMinute"
      )
    )
);

CREATE UNIQUE INDEX "store_business_hours_officialAccountId_day_key"
  ON "store_business_hours"("officialAccountId", "day");
CREATE INDEX "store_business_hours_officialAccountId_idx"
  ON "store_business_hours"("officialAccountId");

ALTER TABLE "store_business_hours"
  ADD CONSTRAINT "store_business_hours_officialAccountId_fkey"
  FOREIGN KEY ("officialAccountId") REFERENCES "official_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
