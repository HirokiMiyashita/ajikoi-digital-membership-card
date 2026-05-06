import { requireAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import MemberSettingsClient from "./member-settings-client";

function toPreviewImageUrl(imageUrl: string) {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }
  return `/api/admin/blob?pathname=${encodeURIComponent(imageUrl)}`;
}

export default async function AdminMemberSettingsPage() {
  const adminUser = await requireAdminUser();
  const scopeKey = adminUser.officialAccountId ?? "global";

  const [gifts, ranks, setting] = await Promise.all([
    prisma.gift.findMany({
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        imageUrl: true,
      },
      take: 500,
    }),
    prisma.rank.findMany({
      orderBy: {
        minPoints: "asc",
      },
      select: {
        id: true,
        name: true,
        minPoints: true,
      },
    }),
    prisma.memberBenefitSetting.findUnique({
      where: { scopeKey },
      select: {
        signupGiftId: true,
        topRankLoopGiftId: true,
        rankBenefitGiftSettings: {
          select: {
            rankId: true,
            giftId: true,
          },
        },
      },
    }),
  ]);

  const rankGiftMap = Object.fromEntries(
    (setting?.rankBenefitGiftSettings ?? []).map((row) => [row.rankId, row.giftId]),
  );

  return (
    <MemberSettingsClient
      gifts={gifts.map((gift) => ({
        id: gift.id,
        title: gift.title,
        previewImageUrl: toPreviewImageUrl(gift.imageUrl),
      }))}
      ranks={ranks.map((rank) => ({
        id: rank.id,
        name: rank.name,
        minPoints: rank.minPoints,
      }))}
      initialSignupGiftId={setting?.signupGiftId ?? null}
      initialTopRankLoopGiftId={setting?.topRankLoopGiftId ?? null}
      initialRankGiftMap={rankGiftMap}
    />
  );
}
