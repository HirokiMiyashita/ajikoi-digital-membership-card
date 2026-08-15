import { BusinessHourDay } from "@prisma/client";
import { z } from "zod";

import { getCurrentAdminUser } from "@/lib/admin-guard";
import { BUSINESS_HOUR_DAYS, timeToMinute } from "@/lib/business-hours";
import { prisma } from "@/lib/prisma";

const rowSchema = z.object({
  day: z.nativeEnum(BusinessHourDay),
  isClosed: z.boolean(),
  openingTime: z.string(),
  closingTime: z.string(),
});

export async function PUT(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin?.officialAccountId) {
    return Response.json({ message: "認証が必要です。" }, { status: 401 });
  }

  const parsed = z.object({ hours: z.array(rowSchema) }).safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ message: "営業時間の入力内容が不正です。" }, { status: 400 });
  }

  const daySet = new Set(parsed.data.hours.map((row) => row.day));
  if (
    parsed.data.hours.length !== BUSINESS_HOUR_DAYS.length ||
    BUSINESS_HOUR_DAYS.some((day) => !daySet.has(day))
  ) {
    return Response.json({ message: "月曜日から祝日まで、すべて設定してください。" }, { status: 400 });
  }

  try {
    const normalized = parsed.data.hours.map((row) => {
      const openingMinute = row.isClosed ? null : timeToMinute(row.openingTime);
      const closingMinute = row.isClosed ? null : timeToMinute(row.closingTime);
      if (
        !row.isClosed &&
        (openingMinute === null || closingMinute === null || openingMinute === closingMinute)
      ) {
        throw new Error(`${row.day}の開始時刻と終了時刻を確認してください。`);
      }
      return { ...row, openingMinute, closingMinute };
    });

    await prisma.$transaction(
      normalized.map((row) =>
        prisma.storeBusinessHour.upsert({
          where: {
            officialAccountId_day: {
              officialAccountId: admin.officialAccountId!,
              day: row.day,
            },
          },
          create: {
            officialAccountId: admin.officialAccountId!,
            day: row.day,
            isClosed: row.isClosed,
            openingMinute: row.openingMinute,
            closingMinute: row.closingMinute,
          },
          update: {
            isClosed: row.isClosed,
            openingMinute: row.openingMinute,
            closingMinute: row.closingMinute,
          },
        }),
      ),
    );
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "営業時間の保存に失敗しました。" },
      { status: 400 },
    );
  }
}
