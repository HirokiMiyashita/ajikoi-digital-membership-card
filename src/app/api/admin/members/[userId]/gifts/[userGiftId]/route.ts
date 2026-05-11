import { adminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ userId: string; userGiftId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
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

    const { userId, userGiftId } = await context.params;
    const target = await prisma.userGift.findFirst({
      where: {
        id: userGiftId,
        userId,
      },
      select: {
        id: true,
        user: {
          select: {
            officialAccountId: true,
          },
        },
      },
    });
    if (!target) {
      return Response.json({ ok: false, message: "対象ギフトが見つかりません。" }, { status: 404 });
    }
    if (
      adminUser.officialAccountId &&
      target.user.officialAccountId !== adminUser.officialAccountId
    ) {
      return Response.json({ ok: false, message: "他店舗ユーザーのギフトは更新できません。" }, { status: 403 });
    }

    const now = new Date();
    const updated = await prisma.userGift.updateMany({
      where: {
        id: target.id,
        userId,
        isUsed: false,
      },
      data: {
        isUsed: true,
        usedAt: now,
      },
    });
    if (updated.count === 0) {
      return Response.json({ ok: false, message: "対象ギフトは既に使用済みです。" }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("/api/admin/members/[userId]/gifts/[userGiftId] PATCH error", error);
    return Response.json({ ok: false, message: "使用済み更新に失敗しました。" }, { status: 500 });
  }
}
