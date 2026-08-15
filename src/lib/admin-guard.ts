import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentAdminUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const authUserId = data?.claims?.sub;
  if (error || !authUserId) {
    return null;
  }

  return prisma.adminUser.findUnique({
    where: { id: authUserId },
  });
}

export async function requireAdminUser() {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) {
    redirect("/admin/login");
  }
  if (!adminUser.officialAccountId) {
    redirect("/admin/onboarding");
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
