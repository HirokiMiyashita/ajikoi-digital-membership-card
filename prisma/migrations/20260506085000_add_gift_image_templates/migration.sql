CREATE TABLE "gift_image_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gift_image_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gift_image_templates_sortOrder_key" ON "gift_image_templates"("sortOrder");
