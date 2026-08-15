import { z } from "zod";

import { getCurrentAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { ensureStoreRanks } from "@/lib/store-ranks";

const rankPayloadSchema = z.object({
  ranks: z
    .array(
      z.object({
        id: z.string().trim().min(1).optional(),
        name: z.string().trim().min(1).max(30),
        minPoints: z.number().int().min(0).max(1_000_000_000),
      }),
    )
    .min(1, "ランクを1つ以上設定してください。")
    .max(10, "ランクは10個以内で設定してください。"),
});

export async function PUT(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin?.officialAccountId) {
    return Response.json({ message: "認証が必要です。" }, { status: 401 });
  }

  const parsed = rankPayloadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" },
      { status: 400 },
    );
  }

  const ranks = parsed.data.ranks;
  if (ranks[0].minPoints !== 0) {
    return Response.json(
      { message: "最初のランクの必要ポイントは0にしてください。" },
      { status: 400 },
    );
  }
  for (let index = 1; index < ranks.length; index += 1) {
    if (ranks[index].minPoints <= ranks[index - 1].minPoints) {
      return Response.json(
        { message: "必要ポイントはランク順に大きくなるよう設定してください。" },
        { status: 400 },
      );
    }
  }
  if (new Set(ranks.map((rank) => rank.name)).size !== ranks.length) {
    return Response.json(
      { message: "同じランク名を複数設定できません。" },
      { status: 400 },
    );
  }

  await ensureStoreRanks(admin.officialAccountId);
  const requestedExistingIds = ranks.flatMap((rank) => (rank.id ? [rank.id] : []));
  if (requestedExistingIds.length > 0) {
    const ownedCount = await prisma.rank.count({
      where: {
        officialAccountId: admin.officialAccountId,
        id: { in: requestedExistingIds },
      },
    });
    if (ownedCount !== requestedExistingIds.length) {
      return Response.json(
        { message: "他店舗または存在しないランクが含まれています。" },
        { status: 400 },
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.rank.updateMany({
      where: { officialAccountId: admin.officialAccountId },
      data: { sortOrder: { increment: 1000 } },
    });

    const savedIds: string[] = [];
    for (let index = 0; index < ranks.length; index += 1) {
      const rank = ranks[index];
      const maxPoints =
        index < ranks.length - 1 ? ranks[index + 1].minPoints - 1 : 2_147_483_647;
      if (rank.id) {
        await tx.rank.update({
          where: { id: rank.id },
          data: {
            name: rank.name,
            minPoints: rank.minPoints,
            maxPoints,
            sortOrder: index,
            isActive: true,
          },
        });
        savedIds.push(rank.id);
      } else {
        const created = await tx.rank.create({
          data: {
            officialAccountId: admin.officialAccountId,
            name: rank.name,
            minPoints: rank.minPoints,
            maxPoints,
            sortOrder: index,
            isActive: true,
          },
          select: { id: true },
        });
        savedIds.push(created.id);
      }
    }

    await tx.$executeRaw`
      UPDATE "users" u
      SET "nextRank" = (
        SELECT r."id"
        FROM "ranks" r
        WHERE r."officialAccountId" = ${admin.officialAccountId}
          AND r."isActive" = true
          AND r."minPoints" <= u."points"
        ORDER BY r."minPoints" DESC
        LIMIT 1
      )
      WHERE u."officialAccountId" = ${admin.officialAccountId}
    `;

    const deliveryTriggers = await tx.lineDeliveryTriggerSetting.findMany({
      where: { officialAccountId: admin.officialAccountId },
      select: { id: true, targetRankIds: true },
    });
    for (const trigger of deliveryTriggers) {
      const nextTargetRankIds = trigger.targetRankIds.filter((id) => savedIds.includes(id));
      if (nextTargetRankIds.length !== trigger.targetRankIds.length) {
        await tx.lineDeliveryTriggerSetting.update({
          where: { id: trigger.id },
          data: { targetRankIds: nextTargetRankIds },
        });
      }
    }

    await tx.rank.deleteMany({
      where: {
        officialAccountId: admin.officialAccountId,
        id: { notIn: savedIds },
      },
    });
  });

  const savedRanks = await prisma.rank.findMany({
    where: {
      officialAccountId: admin.officialAccountId,
      isActive: true,
    },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      minPoints: true,
      sortOrder: true,
    },
  });
  return Response.json({ ok: true, ranks: savedRanks });
}
