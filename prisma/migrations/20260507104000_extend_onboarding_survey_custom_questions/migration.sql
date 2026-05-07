-- CreateEnum
CREATE TYPE "OnboardingSurveyQuestionType" AS ENUM ('single_select', 'date', 'text');

-- CreateEnum
CREATE TYPE "OnboardingSurveyPresetKey" AS ENUM ('gender', 'visitFrequency', 'companionType', 'birthDate');

-- AlterTable
ALTER TABLE "onboarding_survey_question_settings"
  ADD COLUMN "presetKey" "OnboardingSurveyPresetKey",
  ADD COLUMN "questionType" "OnboardingSurveyQuestionType" NOT NULL DEFAULT 'text',
  ADD COLUMN "options" JSONB,
  ADD COLUMN "placeholder" TEXT;

-- Backfill existing preset rows
UPDATE "onboarding_survey_question_settings"
SET
  "presetKey" = "questionKey"::text::"OnboardingSurveyPresetKey",
  "questionType" = CASE
    WHEN "questionKey"::text = 'birthDate' THEN 'date'::"OnboardingSurveyQuestionType"
    ELSE 'single_select'::"OnboardingSurveyQuestionType"
  END,
  "options" = CASE
    WHEN "questionKey"::text = 'gender' THEN '[{"value":"male","label":"男性"},{"value":"female","label":"女性"},{"value":"other","label":"その他"}]'::jsonb
    WHEN "questionKey"::text = 'visitFrequency' THEN '[{"value":"1","label":"1回"},{"value":"2","label":"2回"},{"value":"3","label":"3回"},{"value":"4","label":"4回"},{"value":"5_plus","label":"5回以上"}]'::jsonb
    WHEN "questionKey"::text = 'companionType' THEN '[{"value":"alone","label":"ひとり"},{"value":"family","label":"家族"},{"value":"partner_or_friends","label":"友人・パートナー"},{"value":"coworkers","label":"職場関係"},{"value":"other","label":"その他"}]'::jsonb
    ELSE '[]'::jsonb
  END,
  "placeholder" = NULL;

-- Change question key to text for custom keys
ALTER TABLE "onboarding_survey_question_settings"
  ALTER COLUMN "questionKey" TYPE TEXT USING "questionKey"::text;

-- Drop now-unused enum
DROP TYPE "OnboardingSurveyQuestionKey";

-- Remove default: app always sets explicit type
ALTER TABLE "onboarding_survey_question_settings"
  ALTER COLUMN "questionType" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "onboarding_survey_question_settings_scopeKey_presetKey_idx"
ON "onboarding_survey_question_settings"("scopeKey", "presetKey");

-- CreateTable
CREATE TABLE "onboarding_survey_answers" (
  "id" TEXT NOT NULL,
  "surveyId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "questionKey" TEXT NOT NULL,
  "valueText" TEXT,
  "valueOption" TEXT,
  "valueDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "onboarding_survey_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_survey_answers_surveyId_questionId_key"
ON "onboarding_survey_answers"("surveyId", "questionId");

-- CreateIndex
CREATE INDEX "onboarding_survey_answers_questionKey_idx"
ON "onboarding_survey_answers"("questionKey");

-- AddForeignKey
ALTER TABLE "onboarding_survey_answers"
ADD CONSTRAINT "onboarding_survey_answers_surveyId_fkey"
FOREIGN KEY ("surveyId") REFERENCES "user_surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_survey_answers"
ADD CONSTRAINT "onboarding_survey_answers_questionId_fkey"
FOREIGN KEY ("questionId") REFERENCES "onboarding_survey_question_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
