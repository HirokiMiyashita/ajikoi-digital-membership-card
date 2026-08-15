import { GiftExpiryType } from "@prisma/client";

import { adminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type GiftPayload = {
  title?: string;
  usageGuide?: string;
  expiryType?: "DAYS_AFTER_ISSUE" | "FIXED_DATE";
  expiryDays?: number;
  expiryAt?: string;
  imagePath?: string;
  imageUrl?: string;
};

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
  if (!adminUser?.officialAccountId) {
    return Response.json(
      { ok: false, message: "管理者権限がありません。" },
      { status: 403 },
    );
  }

  const payload = (await request.json()) as GiftPayload;
  const title = payload.title?.trim() ?? "";
  const usageGuide = payload.usageGuide?.trim() ?? "";
  const imagePath = (payload.imagePath ?? payload.imageUrl)?.trim() ?? "";
  const expiryType = payload.expiryType;

  if (!title || !usageGuide || !imagePath || !expiryType) {
    return Response.json(
      { ok: false, message: "特典名・利用ガイド・有効期限・画像URLは必須です。" },
      { status: 400 },
    );
  }

  if (expiryType !== "DAYS_AFTER_ISSUE" && expiryType !== "FIXED_DATE") {
    return Response.json(
      { ok: false, message: "有効期限の種別が不正です。" },
      { status: 400 },
    );
  }

  let expiryDays: number | null = null;
  let expiryAt: Date | null = null;
  if (expiryType === "DAYS_AFTER_ISSUE") {
    if (!Number.isInteger(payload.expiryDays) || (payload.expiryDays ?? 0) <= 0) {
      return Response.json(
        { ok: false, message: "配布からの日数は1以上の整数で指定してください。" },
        { status: 400 },
      );
    }
    expiryDays = payload.expiryDays ?? null;
  } else {
    const parsed = payload.expiryAt ? new Date(payload.expiryAt) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      return Response.json(
        { ok: false, message: "特定日付を正しく入力してください。" },
        { status: 400 },
      );
    }
    expiryAt = parsed;
  }

  const created = await prisma.gift.create({
    data: {
      officialAccountId: adminUser.officialAccountId,
      title,
      usageGuide,
      imageUrl: imagePath,
      expiryType: expiryType as GiftExpiryType,
      expiryDays,
      expiryAt,
    },
  });

  return Response.json({ ok: true, id: created.id });
}
