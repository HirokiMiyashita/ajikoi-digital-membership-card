"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { rpcClient } from "@/orpc/client";

type Profile = {
  displayName: string;
  userId: string;
  pictureUrl?: string;
  statusMessage?: string;
};


export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [points, setPoints] = useState(0);
  const [currentRankName, setCurrentRankName] = useState("レギュラー");
  const [nextRankName, setNextRankName] = useState<string | null>("シルバー");
  const [pointsToNextRank, setPointsToNextRank] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  const afterCheckinLiffUrl = process.env.NEXT_PUBLIC_AFTER_CHECKIN_LIFF_URL;

  useEffect(() => {
    const initializeLiff = async () => {
      if (!liffId) {
        return;
      }

      try {
        const { default: liff } = await import("@line/liff");
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const userProfile = await liff.getProfile();
        setProfile(userProfile);
        const syncResult = await rpcClient.user.upsertFromLiff({
          userId: userProfile.userId,
          displayName: userProfile.displayName,
        });
        console.log(syncResult);
        setPoints(syncResult.points);
        setCurrentRankName(syncResult.currentRankName);
        setNextRankName(syncResult.nextRankName);
        setPointsToNextRank(syncResult.pointsToNextRank);
        setCheckedInToday(syncResult.checkedInToday);
        if (syncResult.checkedInToday) {
          setScanMessage("本日の入店ポイントは付与済みです。");
        }
      } catch (error) {
        console.error(error);
      }
    };

    void initializeLiff();
  }, [liffId]);

  const progressToNextRank =
    nextRankName === null ? 100 : Math.min(((points + pointsToNextRank) === 0 ? 0 : (points / (points + pointsToNextRank)) * 100), 100);

  const handleScanAndCheckin = async () => {
    if (!profile || isScanning) {
      return;
    }

    setIsScanning(true);
    setScanMessage("QRコードを読み取っています...");

    try {
      const { default: liff } = await import("@line/liff");

      if (!liff.isInClient()) {
        setScanMessage("LINEアプリ内で読み取りしてください。");
        return;
      }

      const scanResult = await liff.scanCodeV2();
      if (!scanResult?.value) {
        setScanMessage("QR読み取りをキャンセルしました。");
        return;
      }

      const result = await rpcClient.user.addVisitPoint({
        userId: profile.userId,
        qrValue: scanResult.value,
      });

      setPoints(result.points);
      setCurrentRankName(result.currentRankName);
      setNextRankName(result.nextRankName);
      setPointsToNextRank(result.pointsToNextRank);
      setCheckedInToday(result.checkedInToday);
      setScanMessage("+1ポイントを付与しました。");

      if (afterCheckinLiffUrl) {
        liff.openWindow({
          url: afterCheckinLiffUrl,
          external: false,
        });
      }
    } catch (error) {
      setScanMessage(error instanceof Error ? error.message : "ポイント付与に失敗しました。");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#f3f4f7] px-4 pb-5 font-sans text-[#1f2937]">
      <div className="relative -mx-4 bg-white px-4 pt-4 pb-0">
        <div className="relative -mx-4 px-4 pb-0">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-36 rounded-t-[100%] bg-[#f3f4f7]"
        />
        <section className="relative z-10 mx-auto h-[160px] w-[76%] rounded-xl bg-[#0f766e] p-5 text-white shadow-md">
          <p className="text-sm font-semibold">あの味が恋しい。</p>
          <h2 className="mt-1 text-[18px] font-bold tracking-wide">{currentRankName}</h2>
          <p className="mt-2 text-base">
            {nextRankName ? `+${pointsToNextRank}P でランクアップ` : "最高ランクです"}
          </p>
          <div className="mt-3 h-[3px] w-full rounded-full bg-white/25">
            <div
              className="h-1.5 rounded-full bg-white"
              style={{ width: `${progressToNextRank}%` }}
            />
          </div>
          <div className="mt-2 flex items-end justify-between text-sm">
            <p>{profile?.displayName ?? "ゲスト"}</p>
            <p>{points}P</p>
          </div>
        </section>
        </div>
      </div>

      <section className="relative mt-3 overflow-hidden rounded-xl bg-white px-5 pt-6 shadow-sm w-[94%] mx-auto">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 h-20 w-20 overflow-hidden"
        >
          <span className="absolute right-[-30px] top-[12px] block w-28 rotate-45 bg-[#facc15] py-1 text-center text-[11px] font-bold text-[#1f2937]">
            ランク特典
          </span>
        </div>
        <p className="text-center text-1xl font-bold leading-tight">
          {nextRankName ? (
            <>
              あと <span className="text-[#d97706]">{pointsToNextRank}POINT</span>で{nextRankName}
              <br />
              <span className="text-sm">ランクアップ特典GET</span>
            </>
          ) : (
            <>現在のランクは最上位です</>
          )}
        </p>
        <p className="mt-2 text-center text-sm text-[#6b7280]">
          QR読み込みで1POINT獲得できます
        </p>
        <button
          type="button"
          onClick={() => void handleScanAndCheckin()}
          disabled={!profile || isScanning || checkedInToday}
          className="mt-4 w-full rounded-lg bg-[#0f766e] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
        >
          {checkedInToday ? "本日は付与済みです" : isScanning ? "読み取り中..." : "QRを読み取って入店する"}
        </button>
        {scanMessage ? (
          <p className="mt-2 text-center text-xs text-[#334155]" aria-live="polite">
            {scanMessage}
          </p>
        ) : null}
        <div className="-mx-5 mt-5 border-t border-[#d1d5db]">
          <Link
            href="/benefits"
            className="flex w-full items-center justify-between px-5 py-4 text-left font-semibold text-[#111827] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
          >
            <span className="text-xs">もらえる特典をチェック</span>
            <span aria-hidden="true" className="text-[#14b8a6]">
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </span>
          </Link>
        </div>
      </section>
      <section className="mt-4 w-[94%] mx-auto">
        <h3 className="mb-3 flex items-center gap-2 text-xl font-bold text-[#111827]">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#dcfce7] text-lg">
            🎁
          </span>
          持っている特典
        </h3>
        <div className="rounded-xl border border-[#d1d5db] bg-white px-6 py-10 text-center text-[#94a3b8] shadow-sm">
          <p className="text-base">持っている特典がありません</p>
          <p className="mt-4 text-5xl">🎁</p>
          <p className="mt-4 text-sm leading-6">
            会員限定のお得な情報や
            <br />
            特典の配布をおまちください
          </p>
        </div>
      </section>
    </main>
  );
}
