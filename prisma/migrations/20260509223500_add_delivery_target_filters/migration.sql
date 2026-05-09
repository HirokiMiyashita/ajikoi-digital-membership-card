-- CreateEnum
CREATE TYPE "DeliveryVisitCountSegment" AS ENUM ('ZERO', 'ONE', 'TWO_TO_FOUR', 'FIVE_TO_NINE', 'TEN_OR_MORE');

-- AlterTable
ALTER TABLE "line_delivery_trigger_settings"
ADD COLUMN "targetGender" TEXT,
ADD COLUMN "targetRankIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "targetVisitCountSegments" "DeliveryVisitCountSegment"[] DEFAULT ARRAY[]::"DeliveryVisitCountSegment"[];
