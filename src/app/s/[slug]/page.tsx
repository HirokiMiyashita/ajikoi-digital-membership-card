import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { normalizeStoreSlug } from "@/lib/store";
import MembershipCard, { type PublicStoreProfile } from "./membership-card";

type StorePageProps = { params: Promise<{ slug: string }> };

async function getPublicStore(slug: string): Promise<PublicStoreProfile | null> {
  const store = await prisma.officialAccount.findUnique({
    where: { slug: normalizeStoreSlug(slug) },
    include: {
      memberBenefitSettings: {
        select: {
          reviewGiftId: true,
          reviewPasswordHash: true,
          topRankLoopGiftId: true,
          rankBenefitGiftSettings: {
            select: { id: true },
          },
        },
        take: 1,
      },
      _count: {
        select: { gifts: true },
      },
    },
  });
  if (!store) return null;
  const benefitSetting = store.memberBenefitSettings[0];
  return {
    slug: store.slug,
    displayName: store.displayName ?? store.name ?? "デジタル会員証",
    logoUrl: store.logoUrl,
    themeColor: store.themeColor,
    liffId: store.liffId,
    lineAddFriendUrl: store.lineAddFriendUrl,
    googleReviewUrl: store.googleReviewUrl,
    features: {
      rankProgram:
        Boolean(benefitSetting?.topRankLoopGiftId) ||
        Boolean(benefitSetting?.rankBenefitGiftSettings.length),
      reviewCampaign:
        Boolean(store.googleReviewUrl) &&
        Boolean(benefitSetting?.reviewGiftId) &&
        Boolean(benefitSetting?.reviewPasswordHash),
      gifts: store._count.gifts > 0,
    },
  };
}

export async function generateMetadata({ params }: StorePageProps): Promise<Metadata> {
  const { slug } = await params;
  const store = await getPublicStore(slug);
  return { title: store ? `${store.displayName} 会員証` : "店舗が見つかりません" };
}

export default async function StoreMembershipPage({ params }: StorePageProps) {
  const { slug } = await params;
  const store = await getPublicStore(slug);
  if (!store) notFound();
  return <MembershipCard store={store} />;
}
