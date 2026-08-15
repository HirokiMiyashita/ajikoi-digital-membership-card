import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminUser } from "@/lib/admin-guard";
import {
  ONBOARDING_SURVEY_PRESETS,
  type OnboardingSurveyOption,
  type OnboardingSurveyPresetKey,
  getOnboardingSurveyPresetByQuestionKey,
} from "@/lib/onboarding-survey";
import { prisma } from "@/lib/prisma";
const prismaUnsafe = prisma as unknown as {
  $transaction: typeof prisma.$transaction;
};

const payloadSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.string().optional(),
        questionKey: z.string().min(1).max(100),
        presetKey: z.enum(["gender", "visitFrequency", "companionType", "birthDate"]).nullable(),
        questionType: z.enum(["single_select", "date", "text"]),
        label: z.string().min(1).max(100),
        options: z
          .array(
            z.object({
              value: z.string().min(1).max(100),
              label: z.string().min(1).max(100),
            }),
          )
          .default([]),
        placeholder: z.string().max(100).nullable().optional(),
        isEnabled: z.boolean(),
        isRequired: z.boolean(),
        sortOrder: z.number().int().min(0),
      }),
    )
    .min(1),
});

export async function PATCH(request: Request) {
  try {
    const adminUser = await requireAdminUser();
    const body = payloadSchema.parse(await request.json());
    const scopeKey = adminUser.officialAccountId;
    const officialAccountId = adminUser.officialAccountId;

    const presetMap = new Map(ONBOARDING_SURVEY_PRESETS.map((preset) => [preset.questionKey, preset]));
    const sanitized = body.questions.map((question, index) => {
      const preset = question.presetKey
        ? ONBOARDING_SURVEY_PRESETS.find((item) => item.presetKey === question.presetKey) ?? null
        : getOnboardingSurveyPresetByQuestionKey(question.questionKey);
      const questionType = preset ? preset.type : question.questionType;
      const options: OnboardingSurveyOption[] =
        questionType === "single_select"
          ? (preset?.options ?? question.options)
          : [];
      const placeholder =
        questionType === "text" ? (question.placeholder ?? "") : null;
      return {
        questionKey: preset?.questionKey ?? question.questionKey,
        presetKey: (preset?.presetKey ?? question.presetKey) as OnboardingSurveyPresetKey | null,
        questionType,
        label: question.label.trim(),
        options,
        placeholder,
        isEnabled: question.isEnabled,
        isRequired: question.isEnabled ? question.isRequired : false,
        sortOrder: index,
      };
    });
    const hasDuplicateKey = new Set(sanitized.map((question) => question.questionKey)).size !== sanitized.length;
    if (hasDuplicateKey) {
      return NextResponse.json({ error: "質問キーが重複しています。" }, { status: 400 });
    }
    const invalidSelect = sanitized.find(
      (question) => question.questionType === "single_select" && question.options.length < 2,
    );
    if (invalidSelect) {
      return NextResponse.json({ error: "選択式の質問は選択肢を2件以上設定してください。" }, { status: 400 });
    }

    await prismaUnsafe.$transaction(async (tx) => {
      const txUnsafe = tx as unknown as {
        onboardingSurveyQuestionSetting: {
          upsert: (args: unknown) => Promise<unknown>;
          deleteMany: (args: unknown) => Promise<unknown>;
        };
      };
      for (const question of sanitized) {
        await txUnsafe.onboardingSurveyQuestionSetting.upsert({
          where: {
            scopeKey_questionKey: {
              scopeKey,
              questionKey: question.questionKey,
            },
          },
          create: {
            scopeKey,
            officialAccountId,
            questionKey: question.questionKey,
            presetKey: question.presetKey,
            questionType: question.questionType,
            label: question.label,
            options: question.options,
            placeholder: question.placeholder,
            isEnabled: question.isEnabled,
            isRequired: question.isRequired,
            sortOrder: question.sortOrder,
          },
          update: {
            presetKey: question.presetKey,
            questionType: question.questionType,
            label: question.label,
            options: question.options,
            placeholder: question.placeholder,
            isEnabled: question.isEnabled,
            isRequired: question.isRequired,
            sortOrder: question.sortOrder,
          },
        });
      }

      await txUnsafe.onboardingSurveyQuestionSetting.deleteMany({
        where: {
          scopeKey,
          questionKey: {
            notIn: sanitized.map((question) => question.questionKey),
          },
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (cause) {
    if (cause instanceof z.ZodError) {
      return NextResponse.json({ error: "入力内容が不正です。", detail: cause.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "会員登録アンケートの保存に失敗しました。" }, { status: 500 });
  }
}
