"use client";

import { useEffect, useState } from "react";

import { rpcClient } from "@/orpc/client";

type Profile = {
  displayName: string;
  userId: string;
  pictureUrl?: string;
  statusMessage?: string;
};

type LiffStatus = "loading" | "ready" | "error";

export default function Home() {
  const [status, setStatus] = useState<LiffStatus>("loading");
  const [message, setMessage] = useState("Initializing LIFF...");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [syncMessage, setSyncMessage] = useState("未同期");
  const [points, setPoints] = useState(0);
  const [currentRankName, setCurrentRankName] = useState("レギュラー");
  const [nextRankName, setNextRankName] = useState<string | null>("シルバー");
  const [pointsToNextRank, setPointsToNextRank] = useState(0);
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

  useEffect(() => {
    const initializeLiff = async () => {
      if (!liffId) {
        setStatus("error");
        setMessage("NEXT_PUBLIC_LIFF_ID is missing.");
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
        setSyncMessage("usersテーブルへ同期中...");
        const syncResult = await rpcClient.user.upsertFromLiff({
          userId: userProfile.userId,
          displayName: userProfile.displayName,
        });
        console.log(syncResult);
        setPoints(syncResult.points);
        setCurrentRankName(syncResult.currentRankName);
        setNextRankName(syncResult.nextRankName);
        setPointsToNextRank(syncResult.pointsToNextRank);
        setSyncMessage("usersテーブルへの同期が完了しました。");
        setStatus("ready");
        setMessage("LIFF initialized successfully.");
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Unknown LIFF error.");
        setSyncMessage("同期に失敗しました。");
      }
    };

    void initializeLiff();
  }, [liffId]);

  const handleLogout = async () => {
    const { default: liff } = await import("@line/liff");
    if (liff.isLoggedIn()) {
      liff.logout();
      window.location.reload();
    }
  };

  const progressToNextRank =
    nextRankName === null ? 100 : Math.min(((points + pointsToNextRank) === 0 ? 0 : (points / (points + pointsToNextRank)) * 100), 100);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#e5e7eb] px-4 pb-5 font-sans text-[#1f2937]">
      <div className="relative -mx-4 bg-white px-4 pt-4 pb-0">
        <div className="relative -mx-4 px-4 pb-0">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-36 rounded-t-[100%] bg-[#e5e7eb]"
        />
        <section className="relative z-10 mx-auto h-[180px] w-[86%] rounded-xl bg-[#0f766e] p-5 text-white shadow-md">
          <p className="text-sm font-semibold">あの味が恋しい。</p>
          <h2 className="mt-1 text-[18px] font-bold tracking-wide">{currentRankName}</h2>
          <p className="mt-4 text-base">
            {nextRankName ? `+${pointsToNextRank}P でランクアップ` : "最高ランクです"}
          </p>
          <div className="mt-3 h-1.5 w-full rounded-full bg-white/25">
            <div
              className="h-1.5 rounded-full bg-white"
              style={{ width: `${progressToNextRank}%` }}
            />
          </div>
          <div className="mt-4 flex items-end justify-between text-sm">
            <p>{profile?.displayName ?? "ゲスト"}</p>
            <p>{points}P</p>
          </div>
        </section>
        </div>
      </div>

      <section className="mt-3 rounded-xl border border-[#d1d5db] bg-white p-5 shadow-sm">
        <p className="text-center text-3xl font-bold leading-tight">
          {nextRankName ? (
            <>
              あと <span className="text-[#b45309]">{pointsToNextRank}POINT</span>で{nextRankName}
            </>
          ) : (
            <>現在のランクは最上位です</>
          )}
        </p>
        <p className="mt-2 text-center text-sm text-[#64748b]">
          QR読み込みで1POINT獲得できます
        </p>
        <button
          type="button"
          className="mt-4 flex w-full items-center justify-between rounded-lg border border-[#cbd5e1] px-4 py-3 text-left font-semibold text-[#0f172a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
        >
          <span>もらえる特典をチェック</span>
          <span className="text-2xl text-[#0f766e]">→</span>
        </button>
      </section>

      <section className="mt-4 rounded-xl border border-[#d1d5db] bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-base font-bold text-[#111827]">ユーザー情報</h3>
        <p className="text-sm text-[#334155]">
          <span className="font-semibold">name:</span> {profile?.displayName ?? "未取得"}
        </p>
        <p className="mt-1 break-all text-sm text-[#334155]">
          <span className="font-semibold">userId:</span> {profile?.userId ?? "未取得"}
        </p>
      </section>

      <section className="mt-4">
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

      <p className="mt-5 rounded-md bg-[#eef2ff] px-3 py-2 text-sm text-[#334155]" aria-live="polite">
        会員情報 | 状態: {status} | メッセージ: {message} | DB同期: {syncMessage}
      </p>

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full bg-[#111827] px-6 py-3 text-base font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
        >
          × 会員証を閉じる
        </button>
      </div>
    </main>
  );
}
