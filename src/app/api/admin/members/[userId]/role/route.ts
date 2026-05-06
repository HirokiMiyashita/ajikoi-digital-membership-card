import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const roleUpdateSchema = z.object({
  role: z.union([z.literal("staff"), z.null()]),
});

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
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

    const body = await request.json();
    const parsed = roleUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          message: parsed.error.issues[0]?.message ?? "入力内容が不正です。",
        },
        { status: 400 },
      );
    }

    const { userId } = await context.params;
    const targetUser = await prisma.user.findFirst({
      where: {
        userId,
        ...(adminUser.officialAccountId
          ? { officialAccountId: adminUser.officialAccountId }
          : {}),
      },
      select: { userId: true },
    });
    if (!targetUser) {
      return NextResponse.json({ ok: false, message: "対象ユーザーが見つかりません。" }, { status: 404 });
    }

    await prisma.user.update({
      where: { userId },
      data: {
        role: parsed.data.role,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("/api/admin/members/[userId]/role PATCH error", error);
    return NextResponse.json({ ok: false, message: "ロール更新に失敗しました。" }, { status: 500 });
  }
}
