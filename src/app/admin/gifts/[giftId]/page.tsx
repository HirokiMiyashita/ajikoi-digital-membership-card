import { notFound } from "next/navigation";

import { requireAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

import GiftsClient from "../gifts-client";

type Props = {
  params: Promise<{ giftId: string }>;
};

export default async function AdminGiftEditPage({ params }: Props) {
  const admin = await requireAdminUser();
  const { giftId } = await params;

  const gift = await prisma.gift.findFirst({
    where: { id: giftId, officialAccountId: admin.officialAccountId! },
    select: {
      id: true,
      title: true,
      usageGuide: true,
      expiryType: true,
      expiryDays: true,
      expiryAt: true,
      imageUrl: true,
    },
  });

  if (!gift) {
    notFound();
  }

  return (
    <GiftsClient
      mode="edit"
      giftId={gift.id}
      initialValue={{
        title: gift.title,
        usageGuide: gift.usageGuide,
        expiryType: gift.expiryType,
        expiryDays: gift.expiryDays,
        expiryAt: gift.expiryAt?.toISOString() ?? null,
        imagePath: gift.imageUrl,
      }}
    />
  );
}
