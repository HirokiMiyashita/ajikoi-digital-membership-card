import { z } from "zod";

import { adminAuth } from "@/lib/admin-auth";
import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";

const triggerPayloadSchema = z.object({
  message: z.string().trim().min(1, "配信メッセージを入力してください。").max(1000, "メッセージは1000文字以内です。"),
  targetMode: z.enum(["all", "selected"]).default("all"),
  userIds: z.array(z.string().min(1)).optional().default([]),
});

export async function POST(request: Request) {
  try {
    const session = await adminAuth.api.getSession({
      headers: request.headers,
    });
    const adminId = session?.user?.username;
    if (!adminId) {
      return Response.json({ ok: false, message: "管理者ログインが必要です。" }, { status: 401 });
    }

    const adminUser = await prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { id: true, officialAccountId: true },
    });
    if (!adminUser) {
      return Response.json({ ok: false, message: "管理者権限がありません。" }, { status: 403 });
    }

    const parsed = triggerPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { ok: false, message: parsed.error.issues[0]?.message ?? "入力内容が不正です。" },
        { status: 400 },
      );
    }

    const { message, targetMode, userIds } = parsed.data;
    const targetUserIds = targetMode === "selected" ? userIds : [];
    if (targetMode === "selected" && targetUserIds.length === 0) {
      return Response.json({ ok: false, message: "配信対象ユーザーを選択してください。" }, { status: 400 });
    }

    await inngest.send({
      name: "line/delivery.triggered",
      data: {
        message,
        officialAccountId: adminUser.officialAccountId ?? null,
        targetUserIds,
        triggeredBy: adminUser.id,
      },
    });

    return Response.json({ ok: true, message: "トリガー配信を受け付けました。" });
  } catch (error) {
    console.error("/api/admin/spot-delivery/trigger POST error", error);
    return Response.json(
      { ok: false, message: "トリガー配信に失敗しました。" },
      { status: 500 },
    );
  }
}
