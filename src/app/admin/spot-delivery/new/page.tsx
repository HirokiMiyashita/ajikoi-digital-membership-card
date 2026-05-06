import { requireAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import SpotDeliveryEditorClient from "./spot-delivery-editor-client";


function toPreviewImageUrl(imageUrl: string) {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }
  return `/api/admin/blob?pathname=${encodeURIComponent(imageUrl)}`;
}

function resolveLineImageUrl(imageUrl: string, absoluteTemplateUrls: string[]) {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }
  const normalized = imageUrl.replace(/^\/+/, "");
  const matched = absoluteTemplateUrls.find((url) => url.endsWith(`/${normalized}`) || url.endsWith(normalized));
  return matched ?? null;
}

export default async function AdminSpotDeliveryNewPage() {
  const adminUser = await requireAdminUser();
  const [users, gifts, templates, targetCount] = await Promise.all([
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
    prisma.giftImageTemplate.findMany({
      where: { isActive: true },
      select: {
        imageUrl: true,
      },
      take: 100,
    }),
    prisma.user.count({
      where: adminUser.officialAccountId ? { officialAccountId: adminUser.officialAccountId } : undefined,
    }),
  ]);
  const absoluteTemplateUrls = templates
    .map((row) => row.imageUrl)
    .filter((url) => url.startsWith("http://") || url.startsWith("https://"));
  const normalizedGifts = gifts.map((gift) => ({
    ...gift,
    previewImageUrl: toPreviewImageUrl(gift.imageUrl),
    lineImageUrl: resolveLineImageUrl(gift.imageUrl, absoluteTemplateUrls),
  }));

  return <SpotDeliveryEditorClient users={users} gifts={normalizedGifts} targetCount={targetCount} />;
}
