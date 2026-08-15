import { notFound } from "next/navigation";

import { requireAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { getStoreRanks } from "@/lib/store-ranks";
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
  const [trigger, gifts, templates, ranks] = await Promise.all([
    prisma.lineDeliveryTriggerSetting.findFirst({
      where: {
        id: triggerId,
        officialAccountId: adminUser.officialAccountId!,
      },
      select: {
        id: true,
        title: true,
        triggerType: true,
        notificationText: true,
        messages: true,
        message: true,
        targetRankIds: true,
        targetGender: true,
        targetVisitCountSegments: true,
        delayDays: true,
        deliveryHourJst: true,
        isActive: true,
      },
    }),
    prisma.gift.findMany({
      where: { officialAccountId: adminUser.officialAccountId! },
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
    getStoreRanks(adminUser.officialAccountId!),
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
      rankOptions={ranks}
      mode="edit"
      triggerId={trigger.id}
      initialValue={{
        title: trigger.title,
        triggerType: trigger.triggerType as
          | "USER_SIGNUP"
          | "CHECKIN_POINT_GRANTED"
          | "RANK_UP"
          | "BIRTHDAY"
          | "GIFT_EXPIRES",
        notificationText: trigger.notificationText,
        messages: trigger.messages,
        message: trigger.message,
        targetRankIds: trigger.targetRankIds,
        targetGender: (trigger.targetGender as "male" | "female" | "other" | null) ?? null,
        targetVisitCountSegments: trigger.targetVisitCountSegments as Array<
          "ZERO" | "ONE" | "TWO_TO_FOUR" | "FIVE_TO_NINE" | "TEN_OR_MORE"
        >,
        delayDays: trigger.delayDays,
        deliveryHourJst: trigger.deliveryHourJst,
        isActive: trigger.isActive,
      }}
    />
  );
}
