-- AlterTable
ALTER TABLE "users" ADD COLUMN     "nextRank" TEXT NOT NULL DEFAULT 'regular';

-- CreateTable
CREATE TABLE "ranks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minPoints" INTEGER NOT NULL,
    "maxPoints" INTEGER NOT NULL,

    CONSTRAINT "ranks_pkey" PRIMARY KEY ("id")
);

-- Seed ranks
INSERT INTO "ranks" ("id", "name", "minPoints", "maxPoints") VALUES
    ('regular', 'レギュラー', 0, 3),
    ('silver', 'シルバー', 4, 10),
    ('gold', 'ゴールド', 11, 20),
    ('platinum', 'プラチナ', 21, 30);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_nextRank_fkey" FOREIGN KEY ("nextRank") REFERENCES "ranks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
