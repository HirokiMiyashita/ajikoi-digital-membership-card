import { Prisma } from "@prisma/client";
import { z } from "zod";

import { adminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const targetFiltersSchema = z.object({
  rankIds: z.array(z.string().min(1)).optional().default([]),
  gender: z.enum(["male", "female", "other"]).nullable().optional().default(null),
  visitCountSegments: z
    .array(z.enum(["ZERO", "ONE", "TWO_TO_FOUR", "FIVE_TO_NINE", "TEN_OR_MORE"]))
    .optional()
    .default([]),
});

function resolveVisitCountSegment(count: number) {
  if (count <= 0) return "ZERO";
  if (count === 1) return "ONE";
  if (count <= 4) return "TWO_TO_FOUR";
  if (count <= 9) return "FIVE_TO_NINE";
  return "TEN_OR_MORE";
}

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
      select: { officialAccountId: true },
    });
    if (!adminUser?.officialAccountId) {
      return Response.json({ ok: false, message: "管理者権限がありません。" }, { status: 403 });
    }

    const parsed = targetFiltersSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { ok: false, message: parsed.error.issues[0]?.message ?? "入力内容が不正です。" },
        { status: 400 },
      );
    }

    const targetFilters = parsed.data;
    const users = await prisma.user.findMany({
      where: {
        officialAccountId: adminUser.officialAccountId,
        ...(targetFilters.rankIds.length > 0 ? { nextRank: { in: targetFilters.rankIds } } : {}),
        ...(targetFilters.gender ? { survey: { is: { gender: targetFilters.gender } } } : {}),
      },
      select: {
        userId: true,
      },
      take: 10000,
    });

    if (targetFilters.visitCountSegments.length === 0) {
      return Response.json({ ok: true, count: users.length });
    }
    if (users.length === 0) {
      return Response.json({ ok: true, count: 0 });
    }

    const userIds = users.map((row) => row.userId);
    const checkInRows = await prisma.$queryRaw<Array<{ userId: string; checkInCount: number }>>`
      SELECT u."userId" AS "userId", COUNT(c."id")::int AS "checkInCount"
      FROM "users" u
      LEFT JOIN "user_checkins" c ON c."userId" = u."userId"
      WHERE u."userId" IN (${Prisma.join(userIds)})
      GROUP BY u."userId"
    `;
    const count = checkInRows.filter((row) =>
      targetFilters.visitCountSegments.includes(resolveVisitCountSegment(row.checkInCount)),
    ).length;
    return Response.json({ ok: true, count });
  } catch (error) {
    console.error("/api/admin/spot-delivery/targets/count POST error", error);
    return Response.json({ ok: false, message: "配信対象件数の取得に失敗しました。" }, { status: 500 });
  }
}
