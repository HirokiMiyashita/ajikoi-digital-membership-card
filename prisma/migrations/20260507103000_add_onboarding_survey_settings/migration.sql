-- AlterTable
ALTER TABLE "user_surveys"
  ALTER COLUMN "gender" DROP NOT NULL,
  ALTER COLUMN "visitFrequency" DROP NOT NULL,
  ALTER COLUMN "companionType" DROP NOT NULL,
  ALTER COLUMN "birthDate" DROP NOT NULL;

-- CreateEnum
CREATE TYPE "OnboardingSurveyQuestionKey" AS ENUM ('gender', 'visitFrequency', 'companionType', 'birthDate');

-- CreateTable
CREATE TABLE "onboarding_survey_question_settings" (
  "id" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "officialAccountId" TEXT,
  "questionKey" "OnboardingSurveyQuestionKey" NOT NULL,
  "label" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "onboarding_survey_question_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_survey_question_settings_scopeKey_questionKey_key"
ON "onboarding_survey_question_settings"("scopeKey", "questionKey");

-- CreateIndex
CREATE INDEX "onboarding_survey_question_settings_officialAccountId_idx"
ON "onboarding_survey_question_settings"("officialAccountId");

-- CreateIndex
CREATE INDEX "onboarding_survey_question_settings_scopeKey_sortOrder_idx"
ON "onboarding_survey_question_settings"("scopeKey", "sortOrder");

-- AddForeignKey
ALTER TABLE "onboarding_survey_question_settings"
ADD CONSTRAINT "onboarding_survey_question_settings_officialAccountId_fkey"
FOREIGN KEY ("officialAccountId") REFERENCES "official_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
