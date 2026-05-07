import { notFound } from "next/navigation";

import { requireAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import TriggerDeliveryEditorClient from "../new/trigger-delivery-editor-client";

type GiftTemplateUrlRow = {
  imageUrl: string;
};
type GiftRow = {
  id: string;
  title: string;
  imageUrl: string;
  usageGuide: string;
};

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
  const candidates = [normalized];
  if (normalized.endsWith(".svg")) {
    candidates.push(normalized.replace(/\.svg$/i, ".png"));
  }
  const matched = absoluteTemplateUrls.find((url) =>
    candidates.some((candidate) => url.endsWith(`/${candidate}`) || url.endsWith(candidate)),
  );
  return matched ?? null;
}

type Props = {
  params: Promise<{ triggerId: string }>;
};

export default async function AdminTriggerDeliveryEditPage({ params }: Props) {
  const adminUser = await requireAdminUser();
  const { triggerId } = await params;
  const [trigger, gifts, templates] = await Promise.all([
    prisma.lineDeliveryTriggerSetting.findFirst({
      where: {
        id: triggerId,
        ...(adminUser.officialAccountId ? { officialAccountId: adminUser.officialAccountId } : {}),
      },
      select: {
        id: true,
        title: true,
        triggerType: true,
        notificationText: true,
        messages: true,
        message: true,
        isActive: true,
      },
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
  ]);
  if (!trigger) {
    notFound();
  }
  const absoluteTemplateUrls = (templates as GiftTemplateUrlRow[])
    .map((row: GiftTemplateUrlRow) => row.imageUrl)
    .filter((url: string) => url.startsWith("http://") || url.startsWith("https://"));
  const normalizedGifts = (gifts as GiftRow[]).map((gift: GiftRow) => ({
    ...gift,
    previewImageUrl: toPreviewImageUrl(gift.imageUrl),
    lineImageUrl: resolveLineImageUrl(gift.imageUrl, absoluteTemplateUrls),
  }));

  return (
    <TriggerDeliveryEditorClient
      gifts={normalizedGifts}
      mode="edit"
      triggerId={trigger.id}
      initialValue={{
        title: trigger.title,
        triggerType: trigger.triggerType as "USER_SIGNUP" | "CHECKIN_POINT_GRANTED" | "RANK_UP",
        notificationText: trigger.notificationText,
        messages: trigger.messages,
        message: trigger.message,
        isActive: trigger.isActive,
      }}
    />
  );
}
