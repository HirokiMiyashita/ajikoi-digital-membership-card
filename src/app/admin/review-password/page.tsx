import { requireAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

import ReviewPasswordClient from "./review-password-client";

export default async function AdminReviewPasswordPage() {
  const adminUser = await requireAdminUser();
  const scopeKey = adminUser.officialAccountId ?? "global";

  const setting = await prisma.memberBenefitSetting.findUnique({
    where: { scopeKey },
    select: {
      reviewPasswordHash: true,
      updatedAt: true,
    },
  });

  return (
    <ReviewPasswordClient
      hasPassword={Boolean(setting?.reviewPasswordHash)}
      updatedAtIso={setting?.updatedAt?.toISOString() ?? null}
    />
  );
}
