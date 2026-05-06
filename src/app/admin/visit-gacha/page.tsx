import { requireAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

import VisitGachaClient from "./visit-gacha-client";

export default async function AdminVisitGachaPage() {
  const adminUser = await requireAdminUser();
  const scopeKey = adminUser.officialAccountId ?? "global";

  const [gifts, setting] = await Promise.all([
    prisma.gift.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
      take: 200,
    }),
    prisma.visitGachaSetting.findUnique({
      where: { scopeKey },
      select: {
        giftId: true,
        winProbability: true,
        isActive: true,
      },
    }),
  ]);

  return (
    <VisitGachaClient
      gifts={gifts}
      initialSetting={
        setting
          ? {
              giftId: setting.giftId,
              winProbability: setting.winProbability,
              isActive: setting.isActive,
            }
          : null
      }
    />
  );
}
