import { requireAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { getStoreRanks } from "@/lib/store-ranks";

import VisitGachaClient from "./visit-gacha-client";

export default async function AdminVisitGachaPage() {
  const adminUser = await requireAdminUser();
  const scopeKey = adminUser.officialAccountId ?? "global";

  const [gifts, ranks, setting] = await Promise.all([
    prisma.gift.findMany({
      where: { officialAccountId: adminUser.officialAccountId! },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
      take: 200,
    }),
    getStoreRanks(adminUser.officialAccountId!),
    prisma.visitGachaSetting.findUnique({
      where: { scopeKey },
      select: {
        giftId: true,
        winImageUrl: true,
        loseImageUrl: true,
        winProbability: true,
        isActive: true,
        rankProbabilities: {
          select: {
            rankId: true,
            winProbability: true,
          },
        },
      },
    }),
  ]);

  return (
    <VisitGachaClient
      gifts={gifts}
      ranks={ranks}
      initialSetting={
        setting
          ? {
              giftId: setting.giftId,
              winImageUrl: setting.winImageUrl,
              loseImageUrl: setting.loseImageUrl,
              winProbability: setting.winProbability,
              isActive: setting.isActive,
              rankProbabilities: setting.rankProbabilities,
            }
          : null
      }
    />
  );
}
