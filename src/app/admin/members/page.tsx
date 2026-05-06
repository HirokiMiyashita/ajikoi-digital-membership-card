import { requireAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import MembersClient from "./members-client";

export default async function AdminMembersPage() {
  const adminUser = await requireAdminUser();
  const members = await prisma.user.findMany({
    where: adminUser.officialAccountId
      ? { officialAccountId: adminUser.officialAccountId }
      : undefined,
    orderBy: [{ points: "desc" }, { createdAt: "desc" }],
    select: {
      userId: true,
      displayName: true,
      role: true,
      _count: {
        select: {
          checkIns: true,
        },
      },
      rank: {
        select: {
          name: true,
        },
      },
    },
    take: 500,
  });

  return (
    <MembersClient
      initialMembers={members.map((row) => ({
        userId: row.userId,
        displayName: row.displayName,
        role: row.role,
        checkInCount: row._count.checkIns,
        rankName: row.rank.name,
      }))}
    />
  );
}
