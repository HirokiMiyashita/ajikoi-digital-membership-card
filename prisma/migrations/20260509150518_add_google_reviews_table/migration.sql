-- AlterTable
ALTER TABLE "users" ADD COLUMN     "googleReviewId" TEXT;

-- CreateTable
CREATE TABLE "google_reviews" (
    "id" TEXT NOT NULL,
    "reviewText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_googleReviewId_key" ON "users"("googleReviewId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_googleReviewId_fkey" FOREIGN KEY ("googleReviewId") REFERENCES "google_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

