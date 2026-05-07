import { requireAdminUser } from "@/lib/admin-guard";
import {
  ONBOARDING_SURVEY_PRESETS,
  type OnboardingSurveyOption,
  type OnboardingSurveyPresetKey,
  type OnboardingSurveyQuestionType,
} from "@/lib/onboarding-survey";
import { prisma } from "@/lib/prisma";
import SurveySettingsClient from "./survey-settings-client";
const prismaUnsafe = prisma as unknown as {
  onboardingSurveyQuestionSetting: {
    upsert: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
  };
};

type SurveySettingRow = {
  id: string;
  questionKey: string;
  presetKey: OnboardingSurveyPresetKey | null;
  questionType: OnboardingSurveyQuestionType;
  label: string;
  options: OnboardingSurveyOption[];
  placeholder: string | null;
  isEnabled: boolean;
  isRequired: boolean;
  sortOrder: number;
};

async function ensureSurveySettings(officialAccountId: string | null) {
  const scopeKey = officialAccountId ?? "global";
  await prisma.$transaction(async () => {
    for (let index = 0; index < ONBOARDING_SURVEY_PRESETS.length; index += 1) {
      const preset = ONBOARDING_SURVEY_PRESETS[index];
      await prismaUnsafe.onboardingSurveyQuestionSetting.upsert({
        where: {
          scopeKey_questionKey: {
            scopeKey,
            questionKey: preset.questionKey,
          },
        },
        create: {
          scopeKey,
          officialAccountId,
          questionKey: preset.questionKey,
          presetKey: preset.presetKey,
          questionType: preset.type,
          label: preset.label,
          options: preset.options,
          placeholder: preset.placeholder,
          isEnabled: preset.defaultEnabled,
          isRequired: preset.defaultRequired,
          sortOrder: index,
        },
        update: {},
      });
    }
  });

  const rows = (await prismaUnsafe.onboardingSurveyQuestionSetting.findMany({
    where: { scopeKey },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      questionKey: true,
      presetKey: true,
      questionType: true,
      label: true,
      options: true,
      placeholder: true,
      isEnabled: true,
      isRequired: true,
      sortOrder: true,
    },
  })) as Array<{
    id: string;
    questionKey: string;
    presetKey: OnboardingSurveyPresetKey | null;
    questionType: OnboardingSurveyQuestionType;
    label: string;
    options: unknown;
    placeholder: string | null;
    isEnabled: boolean;
    isRequired: boolean;
    sortOrder: number;
  }>;
  return rows;
}

export default async function AdminSurveySettingsPage() {
  const adminUser = await requireAdminUser();
  const settings = await ensureSurveySettings(adminUser.officialAccountId ?? null);
  const normalized: SurveySettingRow[] = settings.map((question) => ({
    id: question.id,
    questionKey: question.questionKey,
    presetKey: question.presetKey,
    questionType: question.questionType,
    label: question.label,
    options: Array.isArray(question.options) ? (question.options as OnboardingSurveyOption[]) : [],
    placeholder: question.placeholder,
    isEnabled: question.isEnabled,
    isRequired: question.isRequired,
    sortOrder: question.sortOrder,
  }));

  return (
    <SurveySettingsClient
      initialQuestions={normalized.map((question) => ({
        id: question.id,
        questionKey: question.questionKey,
        presetKey: question.presetKey,
        questionType: question.questionType,
        label: question.label,
        options: question.options,
        placeholder: question.placeholder,
        isEnabled: question.isEnabled,
        isRequired: question.isRequired,
        sortOrder: question.sortOrder,
      }))}
    />
  );
}
