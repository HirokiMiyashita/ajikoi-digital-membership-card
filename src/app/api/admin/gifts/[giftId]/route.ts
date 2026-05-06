import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

const updateGiftSchema = z
  .object({
    title: z.string().trim().min(1),
    usageGuide: z.string().trim().min(1),
    expiryType: z.enum(["DAYS_AFTER_ISSUE", "FIXED_DATE"]),
    expiryDays: z.number().int().positive().optional().nullable(),
    expiryAt: z.string().datetime().optional().nullable(),
    imagePath: z.string().trim().min(1),
  })
  .superRefine((value, ctx) => {
    if (value.expiryType === "DAYS_AFTER_ISSUE" && !value.expiryDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "有効期限日数を指定してください。",
        path: ["expiryDays"],
      });
    }
    if (value.expiryType === "FIXED_DATE" && !value.expiryAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "有効期限日付を指定してください。",
        path: ["expiryAt"],
      });
    }
  });

type RouteContext = {
  params: Promise<{ giftId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdminUser();
    const { giftId } = await context.params;
    const body = await request.json();
    const parsed = updateGiftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          message: parsed.error.issues[0]?.message ?? "入力内容が不正です。",
        },
        { status: 400 },
      );
    }

    const { title, usageGuide, expiryType, expiryDays, expiryAt, imagePath } = parsed.data;

    const existingGift = await prisma.gift.findUnique({
      where: { id: giftId },
      select: { id: true },
    });
    if (!existingGift) {
      return NextResponse.json(
        { ok: false, message: "対象のギフトが見つかりません。" },
        { status: 404 },
      );
    }

    await prisma.gift.update({
      where: { id: giftId },
      data: {
        title,
        usageGuide,
        expiryType,
        expiryDays: expiryType === "DAYS_AFTER_ISSUE" ? expiryDays ?? null : null,
        expiryAt: expiryType === "FIXED_DATE" && expiryAt ? new Date(expiryAt) : null,
        imageUrl: imagePath,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("/api/admin/gifts/[giftId] PATCH error", error);
    return NextResponse.json(
      { ok: false, message: "ギフト更新に失敗しました。" },
      { status: 500 },
    );
  }
}
