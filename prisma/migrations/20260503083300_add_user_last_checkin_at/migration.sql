-- Add last check-in timestamp for once-per-day check-in control
ALTER TABLE "users"
ADD COLUMN "lastCheckInAt" TIMESTAMP(3);
