import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { adminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function requireAdminUser() {
  const startedAt = Date.now();
  const requestHeaders = await headers();
  const headersResolvedAt = Date.now();
  const session = await adminAuth.api.getSession({
    headers: requestHeaders,
  });
  const sessionResolvedAt = Date.now();

  const adminId = session?.user?.username;
  if (!adminId) {
    redirect("/admin/login");
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: {
      id: adminId,
    },
  });
  const adminResolvedAt = Date.now();

  if (!adminUser) {
    redirect("/admin/login?error=not-allowed");
  }

  const elapsedMs = adminResolvedAt - startedAt;
  if (elapsedMs >= 500) {
    console.info("[admin.requireAdminUser-ms]", {
      total: elapsedMs,
      resolveHeaders: headersResolvedAt - startedAt,
      resolveSession: sessionResolvedAt - headersResolvedAt,
      resolveAdminUser: adminResolvedAt - sessionResolvedAt,
    });
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
