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

type RouteContext = {
  params: Promise<{ triggerId: string }>;
};

async function getAdminScope() {
  const session = await adminAuth.api.getSession({
    headers: await headers(),
  });
  const adminId = session?.user?.username;
  if (!adminId) {
    return { ok: false as const, status: 401, message: "管理者ログインが必要です。" };
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { officialAccountId: true },
  });
  if (!adminUser) {
    return { ok: false as const, status: 403, message: "管理者情報が見つかりません。" };
  }

  return { ok: true as const, adminUser };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const scope = await getAdminScope();
    if (!scope.ok) {
      return NextResponse.json({ ok: false, message: scope.message }, { status: scope.status });
    }

    const parsed = triggerSettingSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: parsed.error.issues[0]?.message ?? "入力内容が不正です。" },
        { status: 400 },
      );
    }

    const { triggerId } = await context.params;
    const target = await prisma.lineDeliveryTriggerSetting.findFirst({
      where: {
        id: triggerId,
        ...(scope.adminUser.officialAccountId ? { officialAccountId: scope.adminUser.officialAccountId } : {}),
      },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json({ ok: false, message: "対象設定が見つかりません。" }, { status: 404 });
    }

    await prisma.lineDeliveryTriggerSetting.update({
      where: { id: triggerId },
      data: {
        title: parsed.data.title,
        triggerType: parsed.data.triggerType,
        message: parsed.data.message,
        isActive: parsed.data.isActive,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("/api/admin/spot-delivery/triggers/[triggerId] PATCH error", error);
    return NextResponse.json({ ok: false, message: "トリガー配信の更新に失敗しました。" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const scope = await getAdminScope();
    if (!scope.ok) {
      return NextResponse.json({ ok: false, message: scope.message }, { status: scope.status });
    }

    const { triggerId } = await context.params;
    const target = await prisma.lineDeliveryTriggerSetting.findFirst({
      where: {
        id: triggerId,
        ...(scope.adminUser.officialAccountId ? { officialAccountId: scope.adminUser.officialAccountId } : {}),
      },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json({ ok: false, message: "対象設定が見つかりません。" }, { status: 404 });
    }

    await prisma.lineDeliveryTriggerSetting.delete({
      where: { id: triggerId },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("/api/admin/spot-delivery/triggers/[triggerId] DELETE error", error);
    return NextResponse.json({ ok: false, message: "トリガー配信の削除に失敗しました。" }, { status: 500 });
  }
}
