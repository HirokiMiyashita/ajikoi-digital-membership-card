export type OnboardingSurveyPresetKey =
  | "gender"
  | "visitFrequency"
  | "companionType"
  | "birthDate";

export type OnboardingSurveyQuestionType = "single_select" | "date" | "text";

export type OnboardingSurveyOption = {
  value: string;
  label: string;
};

export type OnboardingSurveyPreset = {
  presetKey: OnboardingSurveyPresetKey;
  questionKey: string;
  label: string;
  type: OnboardingSurveyQuestionType;
  options: OnboardingSurveyOption[];
  placeholder: string | null;
  defaultRequired: boolean;
  defaultEnabled: boolean;
};

export const ONBOARDING_SURVEY_PRESETS: OnboardingSurveyPreset[] = [
  {
    presetKey: "gender",
    questionKey: "gender",
    label: "性別",
    type: "single_select",
    options: [
      { value: "male", label: "男性" },
      { value: "female", label: "女性" },
      { value: "other", label: "その他" },
    ],
    placeholder: null,
    defaultRequired: true,
    defaultEnabled: true,
  },
  {
    presetKey: "visitFrequency",
    questionKey: "visitFrequency",
    label: "来店回数(これまで来店した回数)",
    type: "single_select",
    options: [
      { value: "1", label: "1回" },
      { value: "2", label: "2回" },
      { value: "3", label: "3回" },
      { value: "4", label: "4回" },
      { value: "5_plus", label: "5回以上" },
    ],
    placeholder: null,
    defaultRequired: true,
    defaultEnabled: true,
  },
  {
    presetKey: "companionType",
    questionKey: "companionType",
    label: "一緒に来店した人",
    type: "single_select",
    options: [
      { value: "alone", label: "ひとり" },
      { value: "family", label: "家族" },
      { value: "partner_or_friends", label: "友人・パートナー" },
      { value: "coworkers", label: "職場関係" },
      { value: "other", label: "その他" },
    ],
    placeholder: null,
    defaultRequired: true,
    defaultEnabled: true,
  },
  {
    presetKey: "birthDate",
    questionKey: "birthDate",
    label: "生年月日",
    type: "date",
    options: [],
    placeholder: null,
    defaultRequired: true,
    defaultEnabled: true,
  },
];

export function getOnboardingSurveyPresetByQuestionKey(questionKey: string) {
  return ONBOARDING_SURVEY_PRESETS.find((preset) => preset.questionKey === questionKey) ?? null;
}

export function getOnboardingSurveyPresetByPresetKey(presetKey: OnboardingSurveyPresetKey) {
  return ONBOARDING_SURVEY_PRESETS.find((preset) => preset.presetKey === presetKey) ?? null;
}
