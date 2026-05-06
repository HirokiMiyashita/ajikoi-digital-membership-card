import { GiftExpiryType } from "@prisma/client";

import { adminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type IssuePayload = {
  userId?: string;
  giftId?: string;
};

function addDays(base: Date, days: number) {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return date;
}

export async function POST(request: Request) {
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

  const payload = (await request.json()) as IssuePayload;
  const userId = payload.userId?.trim();
  const giftId = payload.giftId?.trim();
  if (!userId || !giftId) {
    return Response.json(
      { ok: false, message: "ユーザーとギフトを選択してください。" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { userId },
    select: { userId: true, officialAccountId: true },
  });
  if (!user) {
    return Response.json(
      { ok: false, message: "対象ユーザーが見つかりません。" },
      { status: 404 },
    );
  }
  if (adminUser.officialAccountId && user.officialAccountId !== adminUser.officialAccountId) {
    return Response.json(
      { ok: false, message: "他店舗ユーザーには付与できません。" },
      { status: 403 },
    );
  }

  const gift = await prisma.gift.findUnique({
    where: { id: giftId },
    select: {
      id: true,
      expiryType: true,
      expiryDays: true,
      expiryAt: true,
    },
  });
  if (!gift) {
    return Response.json(
      { ok: false, message: "ギフトが見つかりません。" },
      { status: 404 },
    );
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
      userId: user.userId,
      giftId: gift.id,
      expiresAt,
    },
  });

  return Response.json({ ok: true, id: created.id });
}
