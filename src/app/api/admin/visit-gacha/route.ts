import { z } from "zod";

import { adminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const visitGachaPayloadSchema = z.object({
  giftId: z.string().trim().min(1, "当選ギフトを選択してください。"),
  winProbability: z
    .coerce
    .number()
    .refine((value) => Number.isFinite(value), "当選確率は数値で入力してください。")
    .int("当選確率は整数で入力してください。")
    .min(0, "当選確率は0以上で入力してください。")
    .max(100, "当選確率は100以下で入力してください。"),
  rankWinProbabilities: z
    .array(
      z.object({
        rankId: z.string().trim().min(1, "ランクIDが不正です。"),
        winProbability: z
          .coerce
          .number()
          .refine((value) => Number.isFinite(value), "ランク別当選率は数値で入力してください。")
          .int("ランク別当選率は整数で入力してください。")
          .min(0, "ランク別当選率は0以上で入力してください。")
          .max(100, "ランク別当選率は100以下で入力してください。"),
      }),
    )
    .default([]),
  isActive: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const session = await adminAuth.api.getSession({
      headers: request.headers,
    });
    const adminId = session?.user?.username;
    if (!adminId) {
      return Response.json(
        { ok: false, message: "管理者ログインが必要です。" },
        { status: 401 },
      );
    }

    const adminUser = await prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { id: true, officialAccountId: true },
    });
    if (!adminUser) {
      return Response.json(
        { ok: false, message: "管理者権限がありません。" },
        { status: 403 },
      );
    }

    const parsed = visitGachaPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        {
          ok: false,
          message: parsed.error.issues[0]?.message ?? "入力内容が不正です。",
        },
        { status: 400 },
      );
    }

    const { giftId, winProbability, rankWinProbabilities, isActive } = parsed.data;

    const gift = await prisma.gift.findUnique({
      where: { id: giftId },
      select: { id: true },
    });
    if (!gift) {
      return Response.json(
        { ok: false, message: "選択したギフトが見つかりません。" },
        { status: 404 },
      );
    }

    const uniqueRankRows = Array.from(
      new Map(rankWinProbabilities.map((row) => [row.rankId, row])).values(),
    );
    const existingRankRows = await prisma.rank.findMany({
      where: {
        id: {
          in: uniqueRankRows.map((row) => row.rankId),
        },
      },
      select: { id: true },
    });
    if (existingRankRows.length !== uniqueRankRows.length) {
      return Response.json(
        { ok: false, message: "存在しないランクが指定されています。" },
        { status: 400 },
      );
    }

    const scopeKey = adminUser.officialAccountId ?? "global";
    await prisma.$transaction(async (tx) => {
      const setting = await tx.visitGachaSetting.upsert({
        where: { scopeKey },
        create: {
          scopeKey,
          officialAccountId: adminUser.officialAccountId ?? null,
          giftId,
          winProbability,
          isActive,
        },
        update: {
          giftId,
          winProbability,
          isActive,
        },
        select: {
          id: true,
        },
      });

      await tx.visitGachaRankProbability.deleteMany({
        where: { settingId: setting.id },
      });
      if (uniqueRankRows.length > 0) {
        await tx.visitGachaRankProbability.createMany({
          data: uniqueRankRows.map((row) => ({
            settingId: setting.id,
            rankId: row.rankId,
            winProbability: row.winProbability,
          })),
        });
      }
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("/api/admin/visit-gacha POST error", error);
    return Response.json(
      { ok: false, message: "来店ガチャ設定の保存に失敗しました。" },
      { status: 500 },
    );
  }
}
