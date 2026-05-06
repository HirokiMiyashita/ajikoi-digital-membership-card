import { requireAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

import SpotDeliveryEditorClient from "./spot-delivery-editor-client";

export default async function AdminSpotDeliveryNewPage() {
  const adminUser = await requireAdminUser();
  const [users, gifts, targetCount] = await Promise.all([
    prisma.user.findMany({
      where: adminUser.officialAccountId ? { officialAccountId: adminUser.officialAccountId } : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        userId: true,
        displayName: true,
      },
      take: 300,
    }),
    prisma.gift.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        usageGuide: true,
      },
      take: 200,
    }),
    prisma.user.count({
      where: adminUser.officialAccountId ? { officialAccountId: adminUser.officialAccountId } : undefined,
    }),
  ]);

  return <SpotDeliveryEditorClient users={users} gifts={gifts} targetCount={targetCount} />;
}
