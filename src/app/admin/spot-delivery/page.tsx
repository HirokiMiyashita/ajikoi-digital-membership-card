import { requireAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

import SpotDeliveryClient from "./spot-delivery-client";

export default async function AdminSpotDeliveryPage() {
  const adminUser = await requireAdminUser();
  const users = await prisma.user.findMany({
    where: adminUser.officialAccountId ? { officialAccountId: adminUser.officialAccountId } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      userId: true,
      displayName: true,
    },
    take: 300,
  });

  return <SpotDeliveryClient users={users} />;
}
