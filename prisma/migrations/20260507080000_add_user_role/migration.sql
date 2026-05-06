-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('staff');

-- AlterTable
ALTER TABLE "users"
ADD COLUMN "role" "UserRole";
