import { createHash } from "crypto";

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const updateReviewPasswordSchema = z.object({
  password: z.string().regex(/^\d{4}$/, "4桁の数字で入力してください。"),
});

function hashReviewPassword(password: string) {
  return createHash("sha256").update(`review-password:${password}`).digest("hex");
}

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
    if (!adminUser) {
      return NextResponse.json({ ok: false, message: "管理者情報が見つかりません。" }, { status: 403 });
    }

    const parsed = updateReviewPasswordSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: parsed.error.issues[0]?.message ?? "入力内容が不正です。" },
        { status: 400 },
      );
    }

    const scopeKey = adminUser.officialAccountId ?? "global";
    const saved = await prisma.memberBenefitSetting.upsert({
      where: { scopeKey },
      create: {
        scopeKey,
        officialAccountId: adminUser.officialAccountId ?? null,
        reviewPasswordHash: hashReviewPassword(parsed.data.password),
      },
      update: {
        reviewPasswordHash: hashReviewPassword(parsed.data.password),
      },
      select: {
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      updatedAt: saved.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("/api/admin/review-password PATCH error", error);
    return NextResponse.json({ ok: false, message: "口コミパスワードの保存に失敗しました。" }, { status: 500 });
  }
}
