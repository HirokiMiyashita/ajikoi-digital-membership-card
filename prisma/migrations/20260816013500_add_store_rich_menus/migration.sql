CREATE TYPE "RichMenuStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ERROR');

CREATE TABLE "store_rich_menus" (
    "id" TEXT NOT NULL,
    "officialAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '店舗リッチメニュー',
    "lineRichMenuId" TEXT,
    "imageUrl" TEXT,
    "templateKey" TEXT NOT NULL DEFAULT 'large-6',
    "sizeWidth" INTEGER NOT NULL DEFAULT 2500,
    "sizeHeight" INTEGER NOT NULL DEFAULT 1686,
    "selected" BOOLEAN NOT NULL DEFAULT true,
    "chatBarText" TEXT NOT NULL DEFAULT 'メニュー',
    "areas" JSONB NOT NULL,
    "status" "RichMenuStatus" NOT NULL DEFAULT 'DRAFT',
    "lastPublishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_rich_menus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "store_rich_menus_officialAccountId_key"
ON "store_rich_menus"("officialAccountId");

CREATE UNIQUE INDEX "store_rich_menus_lineRichMenuId_key"
ON "store_rich_menus"("lineRichMenuId");

CREATE INDEX "store_rich_menus_officialAccountId_status_idx"
ON "store_rich_menus"("officialAccountId", "status");

ALTER TABLE "store_rich_menus"
ADD CONSTRAINT "store_rich_menus_officialAccountId_fkey"
FOREIGN KEY ("officialAccountId")
REFERENCES "official_accounts"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
