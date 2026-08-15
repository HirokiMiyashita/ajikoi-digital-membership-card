import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const updateMemberSettingsSchema = z.object({
  signupGiftId: z.string().trim().min(1).nullable().optional(),
  reviewGiftId: z.string().trim().min(1).nullable().optional(),
  topRankLoopGiftId: z.string().trim().min(1).nullable().optional(),
  rankGiftSettings: z
    .array(
      z.object({
        rankId: z.string().trim().min(1),
        giftId: z.string().trim().min(1).nullable(),
      }),
    )
    .optional(),
});

export async function PATCH(request: Request) {
  try {
    const session = await adminAuth.api.getSession({
      headers: await headers(),
    });
    const adminId = session?.user?.username;
    if (!adminId) {
      return NextResponse.json({ ok: false, message: "管理者ログインが必要です。" }, { status: 401 });
    }

    const adminUser = await prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { officialAccountId: true },
    });
    if (!adminUser?.officialAccountId) {
      return NextResponse.json({ ok: false, message: "管理者情報が見つかりません。" }, { status: 403 });
    }

    const parsed = updateMemberSettingsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: parsed.error.issues[0]?.message ?? "入力内容が不正です。" },
        { status: 400 },
      );
    }

    const scopeKey = adminUser.officialAccountId;
    const { signupGiftId, reviewGiftId, topRankLoopGiftId, rankGiftSettings } = parsed.data;

    const requestedGiftIds = new Set<string>();
    if (typeof signupGiftId === "string") requestedGiftIds.add(signupGiftId);
    if (typeof reviewGiftId === "string") requestedGiftIds.add(reviewGiftId);
    if (typeof topRankLoopGiftId === "string") requestedGiftIds.add(topRankLoopGiftId);
    for (const row of rankGiftSettings ?? []) {
      if (row.giftId) requestedGiftIds.add(row.giftId);
    }
    if (requestedGiftIds.size > 0) {
      const existingGiftRows = await prisma.gift.findMany({
        where: {
          id: { in: Array.from(requestedGiftIds) },
          officialAccountId: adminUser.officialAccountId,
        },
        select: { id: true },
      });
      if (existingGiftRows.length !== requestedGiftIds.size) {
        return NextResponse.json(
          { ok: false, message: "存在しないギフトが指定されています。" },
          { status: 400 },
        );
      }
    }

    if (rankGiftSettings) {
      const requestedRankIds = new Set(rankGiftSettings.map((row) => row.rankId));
      const existingRankRows = await prisma.rank.findMany({
        where: { id: { in: Array.from(requestedRankIds) } },
        select: { id: true },
      });
      if (existingRankRows.length !== requestedRankIds.size) {
        return NextResponse.json(
          { ok: false, message: "存在しないランクが指定されています。" },
          { status: 400 },
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      const setting = await tx.memberBenefitSetting.upsert({
        where: { scopeKey },
        create: {
          scopeKey,
          officialAccountId: adminUser.officialAccountId,
        },
        update: {},
        select: {
          id: true,
        },
      });

      const settingPatch: {
        signupGiftId?: string | null;
        reviewGiftId?: string | null;
        topRankLoopGiftId?: string | null;
      } = {};
      if (Object.prototype.hasOwnProperty.call(parsed.data, "signupGiftId")) {
        settingPatch.signupGiftId = signupGiftId ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(parsed.data, "reviewGiftId")) {
        settingPatch.reviewGiftId = reviewGiftId ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(parsed.data, "topRankLoopGiftId")) {
        settingPatch.topRankLoopGiftId = topRankLoopGiftId ?? null;
      }
      if (Object.keys(settingPatch).length > 0) {
        await tx.memberBenefitSetting.update({
          where: { id: setting.id },
          data: settingPatch,
        });
      }

      if (rankGiftSettings) {
        await tx.rankBenefitGiftSetting.deleteMany({
          where: {
            settingId: setting.id,
          },
        });
        const rows = rankGiftSettings
          .filter((row): row is { rankId: string; giftId: string } => Boolean(row.giftId))
          .map((row) => ({
            settingId: setting.id,
            rankId: row.rankId,
            giftId: row.giftId,
          }));
        if (rows.length > 0) {
          await tx.rankBenefitGiftSetting.createMany({
            data: rows,
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("/api/admin/member-settings PATCH error", error);
    return NextResponse.json({ ok: false, message: "会員設定の更新に失敗しました。" }, { status: 500 });
  }
}
