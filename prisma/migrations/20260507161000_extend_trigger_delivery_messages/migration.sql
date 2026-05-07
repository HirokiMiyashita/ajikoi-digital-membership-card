-- AlterTable
ALTER TABLE "line_delivery_trigger_settings"
ADD COLUMN "notificationText" TEXT NOT NULL DEFAULT '',
ADD COLUMN "messages" JSONB;

-- Backfill existing rows as text message array
UPDATE "line_delivery_trigger_settings"
SET
  "notificationText" = COALESCE("message", ''),
  "messages" = jsonb_build_array(
    jsonb_build_object(
      'type', 'text',
      'text', COALESCE("message", '')
    )
  )
WHERE "messages" IS NULL;
