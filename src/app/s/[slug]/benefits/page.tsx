"use client";

import Image from "next/image";

type RankBenefit = {
  rank: string;
  requirement: string;
  title: string;
  imageType: "drink" | "gift";
};

const rankBenefits: RankBenefit[] = [
  { rank: "レギュラー", requirement: "会員登録時", title: "ドリンク1杯サービス ※詳細はスタッフまで！", imageType: "drink" },
  { rank: "シルバー", requirement: "3ポイント到達", title: "ドリンク1杯サービス ※詳細はスタッフまで！", imageType: "drink" },
  { rank: "ゴールド", requirement: "10ポイント到達", title: "ドリンク1杯サービス ※詳細はスタッフまで！", imageType: "drink" },
  { rank: "プラチナ", requirement: "30ポイント到達", title: "選べるスペシャル特典プレゼント ※詳細はスタッフまで！", imageType: "gift" },
  { rank: "ダイヤモンド", requirement: "50ポイント到達", title: "選べるスペシャル特典プレゼント ※詳細はスタッフまで！", imageType: "gift" },
];

function BenefitImage({ imageType }: { imageType: RankBenefit["imageType"] }) {
  if (imageType === "gift") {
    return (
      <div className="h-14 w-32 rounded-xl bg-linear-to-r from-[#5ea2bc] to-[#70abc0] text-center text-3xl leading-14 text-white">
        🎁
      </div>
    );
  }

  return (
    <div className="h-14 w-32 rounded-xl bg-[#e6f5ec] px-2 py-1 text-center pt-3">
      <p className="text-[8px] font-bold text-[#16a34a]">おすすめドリンク</p>
      <p className="text-[12px] font-bold leading-none text-[#16a34a]">1杯プレゼント</p>
      <p className="text-[8px] text-[#16a34a]">詳細はスタッフまで</p>
    </div>
  );
}

function RankCard({ benefit }: { benefit: RankBenefit }) {
  return (
    <article className="overflow-hidden rounded-3xl bg-white shadow-sm">
      <header className="px-6 pb-4 pt-5">
        <h3 className="text-[18px] font-bold leading-tight text-[#0f172a]">{benefit.rank}</h3>
        <p className="mt-1 text-[15px] text-[#111827]">{benefit.requirement}</p>
      </header>
      <div className="border-t border-[#c5dddd] px-6 py-5">
        <div className="flex items-center gap-4">
          <BenefitImage imageType={benefit.imageType} />
          <div className="text-[#111827]">
            <p className="text-xs text-[#1f2937]">取得から30日間有効</p>
            <p className="text-[16px] font-bold leading-tight">{benefit.title}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function BenefitsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#cfe2e1] font-sans text-[#0f172a]">
      <div className="px-5 pb-6 pt-4">
        <section className="mt-6">
          <h2 className="text-center text-[18px] font-bold">ポイントの獲得方法</h2>
          <p className="mt-1 text-center text-[16px] font-bold">QR読み込みで1ポイントGET！</p>
          <div className="mt-4 rounded-[28px] bg-white px-5 py-6">
            <Image
              src="/benefits_QR.png"
              alt="QR読み込みで1ポイント獲得"
              width={538}
              height={313}
              className="mx-auto h-auto w-full max-w-[500px]"
              priority
            />
          </div>
        </section>
      </div>

      <section className="bg-[#a7cecd] px-5 py-6">
        <h2 className="text-[18px] font-bold">2回目以降の来店時に</h2>
        <p className="mt-1 text-[16px] font-bold leading-tight">抽選で「あたり」がでたら獲得</p>
        <article className="mt-4 rounded-3xl bg-white px-4 py-5 shadow-sm">
          <div className="flex items-center gap-4">
            <BenefitImage imageType="drink" />
            <div className="text-[#111827]">
              <p className="text-xs text-[#1f2937]">取得から30日間有効</p>
              <p className="text-[16px] font-bold leading-tight">ドリンク1杯サービス ※詳細はスタッフまで！</p>
            </div>
          </div>
        </article>
      </section>

      <section className="px-5 py-6">
        <h2 className="text-[18px] font-bold">会員ランク特典</h2>
        <div className="mt-4 space-y-4">
          {rankBenefits.map((benefit) => (
            <RankCard key={benefit.rank} benefit={benefit} />
          ))}
        </div>
      </section>

      <section className="bg-[#a7cecd] px-5 py-6">
        <h2 className="text-[18px] font-bold">最高ランクの方限定！QR読込で</h2>
        <p className="mt-1 text-[16px] font-bold">スタンプをためて特典獲得</p>
        <article className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm">
          <header className="px-6 pb-4 pt-5">
            <h3 className="text-[22px] font-bold leading-none">10スタンプ</h3>
          </header>
          <div className="border-t border-[#c5dddd] px-6 py-5">
            <div className="flex items-center gap-4">
              <BenefitImage imageType="drink" />
              <div className="text-[#111827]">
                <p className="text-xs text-[#1f2937]">取得から30日間有効</p>
                <p className="text-[16px] font-bold leading-tight">ドリンク1杯サービス ※詳細はスタッフまで！</p>
              </div>
            </div>
          </div>
        </article>
        <p className="mt-4 text-sm">※ スタンプ特典は繰り返し獲得できます</p>
      </section>
    </main>
  );
}
