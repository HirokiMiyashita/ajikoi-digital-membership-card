import { GiftExpiryType } from "@prisma/client";
import { z } from "zod";

import { adminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

const issueGiftSchema = z.object({
  giftId: z.string().trim().min(1),
});

function addDays(base: Date, days: number) {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return date;
}

async function resolveAdminUser(request: Request) {
  const session = await adminAuth.api.getSession({
    headers: request.headers,
  });
  const adminId = session?.user?.username;
  if (!adminId) {
    return {
      adminUser: null,
      errorResponse: Response.json(
        { ok: false, message: "管理者ログインが必要です。" },
        { status: 401 },
      ),
    };
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { id: true, officialAccountId: true },
  });
  if (!adminUser) {
    return {
      adminUser: null,
      errorResponse: Response.json(
        { ok: false, message: "管理者権限がありません。" },
        { status: 403 },
      ),
    };
  }

  return { adminUser, errorResponse: null };
}

async function resolveTargetUser(userId: string, officialAccountId: string | null) {
  return prisma.user.findFirst({
    where: {
      userId,
      ...(officialAccountId ? { officialAccountId } : {}),
    },
    select: {
      userId: true,
    },
  });
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await resolveAdminUser(request);
    if (auth.errorResponse || !auth.adminUser) {
      return auth.errorResponse;
    }
    const { userId } = await context.params;
    const targetUser = await resolveTargetUser(userId, auth.adminUser.officialAccountId);
    if (!targetUser) {
      return Response.json({ ok: false, message: "対象ユーザーが見つかりません。" }, { status: 404 });
    }

    const [gifts, userGifts] = await Promise.all([
      prisma.gift.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
        },
        take: 500,
      }),
      prisma.userGift.findMany({
        where: { userId: targetUser.userId },
        orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          giftId: true,
          isUsed: true,
          issuedAt: true,
          expiresAt: true,
          usedAt: true,
          gift: {
            select: {
              title: true,
            },
          },
        },
        take: 1000,
      }),
    ]);

    const serializeGift = (gift: (typeof userGifts)[number]) => ({
      userGiftId: gift.id,
      giftId: gift.giftId,
      title: gift.gift.title,
      issuedAt: gift.issuedAt.toISOString(),
      expiresAt: gift.expiresAt.toISOString(),
      usedAt: gift.usedAt ? gift.usedAt.toISOString() : null,
    });

    return Response.json({
      ok: true,
      availableGifts: gifts.map((gift) => ({
        id: gift.id,
        title: gift.title,
      })),
      unusedGifts: userGifts.filter((gift) => !gift.isUsed).map(serializeGift),
      usedGifts: userGifts.filter((gift) => gift.isUsed).map(serializeGift),
    });
  } catch (error) {
    console.error("/api/admin/members/[userId]/gifts GET error", error);
    return Response.json({ ok: false, message: "ギフト情報の取得に失敗しました。" }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await resolveAdminUser(request);
    if (auth.errorResponse || !auth.adminUser) {
      return auth.errorResponse;
    }
    const { userId } = await context.params;
    const targetUser = await resolveTargetUser(userId, auth.adminUser.officialAccountId);
    if (!targetUser) {
      return Response.json({ ok: false, message: "対象ユーザーが見つかりません。" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = issueGiftSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { ok: false, message: parsed.error.issues[0]?.message ?? "入力内容が不正です。" },
        { status: 400 },
      );
    }

    const gift = await prisma.gift.findUnique({
      where: { id: parsed.data.giftId },
      select: {
        id: true,
        expiryType: true,
        expiryDays: true,
        expiryAt: true,
      },
    });
    if (!gift) {
      return Response.json({ ok: false, message: "ギフトが見つかりません。" }, { status: 404 });
    }

    const now = new Date();
    let expiresAt: Date;
    if (gift.expiryType === GiftExpiryType.DAYS_AFTER_ISSUE) {
      const days = gift.expiryDays ?? 0;
      if (days <= 0) {
        return Response.json(
          { ok: false, message: "ギフトの有効期限設定が不正です。" },
          { status: 400 },
        );
      }
      expiresAt = addDays(now, days);
    } else {
      if (!gift.expiryAt) {
        return Response.json(
          { ok: false, message: "ギフトの有効期限設定が不正です。" },
          { status: 400 },
        );
      }
      expiresAt = gift.expiryAt;
    }

    const created = await prisma.userGift.create({
      data: {
        userId: targetUser.userId,
        giftId: gift.id,
        expiresAt,
      },
      select: {
        id: true,
      },
    });

    return Response.json({ ok: true, id: created.id });
  } catch (error) {
    console.error("/api/admin/members/[userId]/gifts POST error", error);
    return Response.json({ ok: false, message: "ギフト付与に失敗しました。" }, { status: 500 });
  }
}
