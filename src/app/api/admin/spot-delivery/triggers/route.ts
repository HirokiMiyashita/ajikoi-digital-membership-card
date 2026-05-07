import { LineDeliveryTriggerType } from "@prisma/client";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const triggerSettingSchema = z.object({
  title: z.string().trim().min(1, "タイトルを入力してください。"),
  triggerType: z.nativeEnum(LineDeliveryTriggerType),
  message: z.string().trim().min(1, "本文を入力してください。"),
  isActive: z.boolean().optional().default(true),
});

export async function POST(request: Request) {
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

    const parsed = triggerSettingSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: parsed.error.issues[0]?.message ?? "入力内容が不正です。" },
        { status: 400 },
      );
    }

    await prisma.lineDeliveryTriggerSetting.create({
      data: {
        officialAccountId: adminUser.officialAccountId ?? null,
        title: parsed.data.title,
        triggerType: parsed.data.triggerType,
        message: parsed.data.message,
        isActive: parsed.data.isActive,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("/api/admin/spot-delivery/triggers POST error", error);
    return NextResponse.json(
      { ok: false, message: "トリガー配信の作成に失敗しました。" },
      { status: 500 },
    );
  }
}
