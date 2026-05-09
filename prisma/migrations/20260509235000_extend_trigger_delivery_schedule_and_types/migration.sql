-- AlterEnum
ALTER TYPE "LineDeliveryTriggerType" ADD VALUE 'BIRTHDAY';
ALTER TYPE "LineDeliveryTriggerType" ADD VALUE 'GIFT_EXPIRES';

-- AlterTable
ALTER TABLE "line_delivery_trigger_settings"
ADD COLUMN "delayDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "deliveryHourJst" INTEGER;
