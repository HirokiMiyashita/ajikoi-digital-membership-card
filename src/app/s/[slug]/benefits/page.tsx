import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getStoreRanks } from "@/lib/store-ranks";

type GiftView = {
  title: string;
  imageUrl: string;
  usageGuide: string;
  expiryType: "DAYS_AFTER_ISSUE" | "FIXED_DATE";
  expiryDays: number | null;
  expiryAt: Date | null;
};

function expiryLabel(gift: GiftView) {
  if (gift.expiryType === "DAYS_AFTER_ISSUE") {
    return gift.expiryDays ? `取得から${gift.expiryDays}日間有効` : "有効期限なし";
  }
  return gift.expiryAt
    ? `${new Intl.DateTimeFormat("ja-JP").format(gift.expiryAt)}まで有効`
    : "有効期限なし";
}

function GiftCard({ gift }: { gift: GiftView }) {
  return (
    <div className="rounded-3xl bg-white px-4 py-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div
          role="img"
          aria-label={gift.title}
          className="h-20 w-32 shrink-0 rounded-xl bg-[#e6f5ec] bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url("${gift.imageUrl.replaceAll('"', "%22")}")` }}
        />
        <div className="min-w-0 text-[#111827]">
          <p className="text-xs text-[#1f2937]">{expiryLabel(gift)}</p>
          <p className="mt-1 text-[16px] font-bold leading-tight">{gift.title}</p>
          {gift.usageGuide ? (
            <p className="mt-1 text-xs leading-relaxed text-[#64748b]">{gift.usageGuide}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function StoreBenefitsPage({ params }: Props) {
  const { slug } = await params;
  const store = await prisma.officialAccount.findUnique({
    where: { slug },
    select: {
      id: true,
      displayName: true,
      name: true,
      themeColor: true,
    },
  });
  if (!store) notFound();

  const [ranks, benefitSetting, gachaSetting] = await Promise.all([
    getStoreRanks(store.id),
    prisma.memberBenefitSetting.findUnique({
      where: { scopeKey: store.id },
      select: {
        topRankLoopGift: {
          select: {
            title: true,
            imageUrl: true,
            usageGuide: true,
            expiryType: true,
            expiryDays: true,
            expiryAt: true,
          },
        },
        rankBenefitGiftSettings: {
          select: {
            rankId: true,
            gift: {
              select: {
                title: true,
                imageUrl: true,
                usageGuide: true,
                expiryType: true,
                expiryDays: true,
                expiryAt: true,
              },
            },
          },
        },
      },
    }),
    prisma.visitGachaSetting.findUnique({
      where: { scopeKey: store.id },
      select: {
        isActive: true,
        gift: {
          select: {
            title: true,
            imageUrl: true,
            usageGuide: true,
            expiryType: true,
            expiryDays: true,
            expiryAt: true,
          },
        },
      },
    }),
  ]);

  const rankGiftMap = new Map(
    (benefitSetting?.rankBenefitGiftSettings ?? []).map((setting) => [
      setting.rankId,
      setting.gift,
    ]),
  );
  const rankBenefits = ranks.flatMap((rank) => {
    const gift = rankGiftMap.get(rank.id);
    return gift ? [{ rank, gift }] : [];
  });
  const topRank = ranks[ranks.length - 1] ?? null;
  const themeColor = store.themeColor || "#0f766e";

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#e8f3f2] font-sans text-[#0f172a]">
      <header className="px-5 pt-6 text-center">
        <p className="text-xs font-bold tracking-wider text-[#64748b]">
          {store.displayName ?? store.name ?? "店舗"} MEMBERSHIP
        </p>
        <h1 className="mt-1 text-xl font-bold">会員特典</h1>
      </header>

      <div className="px-5 pb-6 pt-4">
        <section className="mt-2">
          <h2 className="text-center text-[18px] font-bold">ポイントの獲得方法</h2>
          <p className="mt-1 text-center text-[16px] font-bold">
            店舗QR読み込みで1日1ポイント
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-[28px] bg-white px-4 py-6 text-center">
            {[
              ["1", "店舗のQRを読み込む"],
              ["2", "位置情報を確認"],
              ["3", "ポイント獲得"],
            ].map(([number, label]) => (
              <div key={number} className="flex min-w-0 flex-col items-center">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-white"
                  style={{ backgroundColor: themeColor }}
                >
                  {number}
                </span>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-[#334155]">{label}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {gachaSetting?.isActive && gachaSetting.gift ? (
        <section className="bg-[#cfe2e1] px-5 py-6">
          <h2 className="text-[18px] font-bold">2回目以降の来店ガチャ</h2>
          <p className="mt-1 text-[16px] font-bold leading-tight">
            抽選で当たると特典を獲得できます
          </p>
          <div className="mt-4">
            <GiftCard gift={gachaSetting.gift} />
          </div>
        </section>
      ) : null}

      {rankBenefits.length > 0 ? (
        <section className="px-5 py-6">
          <h2 className="text-[18px] font-bold">会員ランク特典</h2>
          <div className="mt-4 space-y-4">
            {rankBenefits.map(({ rank, gift }) => (
              <article key={rank.id} className="overflow-hidden rounded-3xl bg-white shadow-sm">
                <header className="px-6 py-4" style={{ borderLeft: `6px solid ${themeColor}` }}>
                  <h3 className="text-[18px] font-bold leading-tight">{rank.name}</h3>
                  <p className="mt-1 text-[15px]">{rank.minPoints}ポイント到達</p>
                </header>
                <div className="border-t border-[#c5dddd]">
                  <GiftCard gift={gift} />
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {topRank && benefitSetting?.topRankLoopGift ? (
        <section className="bg-[#cfe2e1] px-5 py-6">
          <h2 className="text-[18px] font-bold">{topRank.name}会員限定</h2>
          <p className="mt-1 text-[16px] font-bold">
            来店10回ごとに繰り返し獲得
          </p>
          <div className="mt-4">
            <GiftCard gift={benefitSetting.topRankLoopGift} />
          </div>
        </section>
      ) : null}
    </main>
  );
}
