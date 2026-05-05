import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { adminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function requireAdminUser() {
  const session = await adminAuth.api.getSession({
    headers: await headers(),
  });

  const adminId = session?.user?.username;
  if (!adminId) {
    redirect("/admin/login");
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: {
      id: adminId,
    },
  });

  if (!adminUser) {
    redirect("/admin/login?error=not-allowed");
  }

  return adminUser;
}

export async function getAdminOfficialAccountId(adminId: string) {
  const adminScopeRows = await prisma.$queryRaw<Array<{ officialAccountId: string | null }>>`
    SELECT "officialAccountId"
    FROM "admin_user"
    WHERE "id" = ${adminId}
    LIMIT 1
  `;

  return adminScopeRows[0]?.officialAccountId ?? null;
}
