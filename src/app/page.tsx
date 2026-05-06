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
type GachaPopupState = {
  open: boolean;
  won: boolean;
  giftTitle: string | null;
};
type OwnedGift = {
  userGiftId: string;
  giftId: string;
  title: string;
  usageGuide: string;
  imageUrl: string;
  expiresAt: string;
};

const surveySteps = ["gender", "visitFrequency", "companionType", "birthDate"] as const;
type SurveyForm = {
  gender: "male" | "female" | "other" | null;
  visitFrequency: "1" | "2" | "3" | "4" | "5_plus" | null;
  companionType: "alone" | "family" | "partner_or_friends" | "coworkers" | "other" | null;
  birthDate: string;
};

const genderOptions: Array<{ value: NonNullable<SurveyForm["gender"]>; label: string }> = [
  { value: "male", label: "男性" },
  { value: "female", label: "女性" },
  { value: "other", label: "その他" },
];
const visitFrequencyOptions: Array<{ value: NonNullable<SurveyForm["visitFrequency"]>; label: string }> = [
  { value: "1", label: "1回" },
  { value: "2", label: "2回" },
  { value: "3", label: "3回" },
  { value: "4", label: "4回" },
  { value: "5_plus", label: "5回以上" },
];
const companionOptions: Array<{ value: NonNullable<SurveyForm["companionType"]>; label: string }> = [
  { value: "alone", label: "ひとり" },
  { value: "family", label: "家族" },
  { value: "partner_or_friends", label: "友人・パートナー" },
  { value: "coworkers", label: "職場関係" },
  { value: "other", label: "その他" },
];

function todayAsYmd() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateLabel(dateString: string) {
  const date = new Date(dateString);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-[#e5e7eb] ${className}`} aria-hidden="true" />;
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [points, setPoints] = useState(0);
  const [currentRankName, setCurrentRankName] = useState("レギュラー");
  const [nextRankName, setNextRankName] = useState<string | null>("シルバー");
  const [pointsToNextRank, setPointsToNextRank] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [isGachaJudging, setIsGachaJudging] = useState(false);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [ownedGifts, setOwnedGifts] = useState<OwnedGift[]>([]);
  const [selectedGift, setSelectedGift] = useState<OwnedGift | null>(null);
  const [armedUseGiftId, setArmedUseGiftId] = useState<string | null>(null);
  const [isUsingGift, setIsUsingGift] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [gachaPopup, setGachaPopup] = useState<GachaPopupState>({
    open: false,
    won: false,
    giftTitle: null,
  });
  const [needsSurvey, setNeedsSurvey] = useState(false);
  const [surveyStep, setSurveyStep] = useState(0);
  const [isSubmittingSurvey, setIsSubmittingSurvey] = useState(false);
  const [surveyError, setSurveyError] = useState<string | null>(null);
  const [surveyForm, setSurveyForm] = useState<SurveyForm>({
    gender: null,
    visitFrequency: null,
    companionType: null,
    birthDate: "",
  });
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

  const fetchOwnedGifts = async (userId: string) => {
    try {
      const result = await rpcClient.user.listOwnedGifts({
        userId,
      });
      setOwnedGifts(result.gifts);
    } catch {
      // ignore fetch error to keep top flow alive
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initializeLiff = async () => {
      const startedAt = performance.now();
      setIsProfileLoading(true);
      if (!liffId) {
        if (!cancelled) {
          setIsProfileLoading(false);
        }
        return;
      }

      try {
        const importStartedAt = performance.now();
        const { default: liff } = await import("@line/liff");
        const importedAt = performance.now();
        await liff.init({ liffId });
        const initializedAt = performance.now();

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const userProfile = await liff.getProfile();
        const ownedGiftsPromise = fetchOwnedGifts(userProfile.userId);
        const profileFetchedAt = performance.now();
        const syncResult = await rpcClient.user.upsertFromLiff({
          userId: userProfile.userId,
          displayName: userProfile.displayName,
        });
        const syncedAt = performance.now();
        if (cancelled) {
          return;
        }

        setProfile(userProfile);
        setPoints(syncResult.points);
        setCurrentRankName(syncResult.currentRankName);
        setNextRankName(syncResult.nextRankName);
        setPointsToNextRank(syncResult.pointsToNextRank);
        setCheckedInToday(syncResult.checkedInToday);
        setNeedsSurvey(!syncResult.hasSurvey);
        if (syncResult.checkedInToday) {
          setScanMessage("本日の入店ポイントは付与済みです。");
        }
        // ギフト取得は upsertFromLiff と並列で先に開始しておく。
        void ownedGiftsPromise;
        setIsProfileLoading(false);
        console.info("[liff-init-ms]", {
          importLiff: Math.round(importedAt - importStartedAt),
          liffInit: Math.round(initializedAt - importedAt),
          getProfile: Math.round(profileFetchedAt - initializedAt),
          upsertFromLiff: Math.round(syncedAt - profileFetchedAt),
          totalToReady: Math.round(syncedAt - startedAt),
        });
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setIsProfileLoading(false);
        }
      }
    };

    void initializeLiff();

    return () => {
      cancelled = true;
    };
  }, [liffId]);

  const progressToNextRank =
    nextRankName === null ? 100 : Math.min(((points + pointsToNextRank) === 0 ? 0 : (points / (points + pointsToNextRank)) * 100), 100);
  const surveyProgress = `${surveyStep + 1}/${surveySteps.length}`;
  const surveyProgressPercent = ((surveyStep + 1) / surveySteps.length) * 100;

  const canProceedSurveyStep = (() => {
    const stepKey = surveySteps[surveyStep];
    if (stepKey === "gender") return surveyForm.gender !== null;
    if (stepKey === "visitFrequency") return surveyForm.visitFrequency !== null;
    if (stepKey === "companionType") return surveyForm.companionType !== null;
    return surveyForm.birthDate.length > 0;
  })();

  const handleSurveyNext = async () => {
    if (!profile || !canProceedSurveyStep) return;
    setSurveyError(null);

    if (surveyStep < surveySteps.length - 1) {
      setSurveyStep((prev) => prev + 1);
      return;
    }

    if (!surveyForm.gender || !surveyForm.visitFrequency || !surveyForm.companionType || !surveyForm.birthDate) {
      setSurveyError("入力内容をご確認ください。");
      return;
    }

    setIsSubmittingSurvey(true);
    try {
      await rpcClient.user.submitOnboardingSurvey({
        userId: profile.userId,
        gender: surveyForm.gender,
        visitFrequency: surveyForm.visitFrequency,
        companionType: surveyForm.companionType,
        birthDate: surveyForm.birthDate,
      });
      setNeedsSurvey(false);
      setScanMessage("アンケート回答ありがとうございました。");
    } catch (error) {
      setSurveyError(error instanceof Error ? error.message : "アンケート送信に失敗しました。");
    } finally {
      setIsSubmittingSurvey(false);
    }
  };

  const handleSurveyBack = () => {
    setSurveyError(null);
    if (surveyStep > 0) {
      setSurveyStep((prev) => prev - 1);
    }
  };

  const handleScanAndCheckin = async () => {
    if (!profile || isScanning) {
      return;
    }

    setIsScanning(true);
    setGachaPopup({ open: false, won: false, giftTitle: null });
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

      setIsGachaJudging(true);
      setScanMessage("判定中...");
      const result = await rpcClient.user.addVisitPoint({
        userId: profile.userId,
        qrValue: scanResult.value,
      });

      setPoints(result.points);
      setCurrentRankName(result.currentRankName);
      setNextRankName(result.nextRankName);
      setPointsToNextRank(result.pointsToNextRank);
      setCheckedInToday(result.checkedInToday);
      if (result.gacha?.executed) {
        setGachaPopup({
          open: true,
          won: result.gacha.won,
          giftTitle: result.gacha.giftTitle ?? null,
        });
        setScanMessage("+1ポイントを付与しました。ガチャ結果を確認してください。");
      } else {
        setScanMessage("+1ポイントを付与しました。");
      }
      await fetchOwnedGifts(profile.userId);
    } catch (error) {
      setScanMessage(error instanceof Error ? error.message : "ポイント付与に失敗しました。");
    } finally {
      setIsGachaJudging(false);
      setIsScanning(false);
    }
  };

  const handleCloseGachaPopup = () => {
    setGachaPopup((prev) => ({ ...prev, open: false }));
  };

  const handleUseGiftClick = async (gift: OwnedGift) => {
    if (isUsingGift || !profile) return;
    if (armedUseGiftId !== gift.userGiftId) {
      setArmedUseGiftId(gift.userGiftId);
      return;
    }

    setIsUsingGift(true);
    try {
      await rpcClient.user.useGift({
        userId: profile.userId,
        userGiftId: gift.userGiftId,
      });
      setSelectedGift(null);
      setArmedUseGiftId(null);
      setToastMessage("特典が使用されました。");
      setTimeout(() => setToastMessage(null), 2200);
      await fetchOwnedGifts(profile.userId);
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : "特典の利用に失敗しました。");
      setTimeout(() => setToastMessage(null), 2200);
    } finally {
      setIsUsingGift(false);
    }
  };

  return (
    <div className="relative">
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#f3f4f7] px-4 pb-5 font-sans text-[#1f2937]">
        <div className="relative -mx-4 bg-white px-4 pt-4 pb-0">
        <div className="relative -mx-4 px-4 pb-0">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-36 rounded-t-[100%] bg-[#f3f4f7]"
        />
        <section className="relative z-10 mx-auto h-[160px] w-[76%] rounded-xl bg-[#0f766e] p-5 text-white shadow-md">
          <p className="text-sm font-semibold">あの味が恋しい。</p>
          {isProfileLoading ? (
            <>
              <Skeleton className="mt-2 h-6 w-28 bg-white/30" />
              <Skeleton className="mt-3 h-4 w-36 bg-white/30" />
              <Skeleton className="mt-4 h-[3px] w-full bg-white/30" />
              <div className="mt-3 flex items-end justify-between">
                <Skeleton className="h-3 w-20 bg-white/30" />
                <Skeleton className="h-4 w-12 bg-white/30" />
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
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
        {isProfileLoading ? (
          <div className="space-y-2">
            <Skeleton className="mx-auto h-6 w-[70%]" />
            <Skeleton className="mx-auto h-4 w-[46%]" />
          </div>
        ) : (
          <>
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
          </>
        )}
        <button
          type="button"
          onClick={() => void handleScanAndCheckin()}
          disabled={isProfileLoading || !profile || isScanning || checkedInToday}
          className="mt-4 w-full rounded-lg bg-[#0f766e] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
        >
          {isProfileLoading
            ? "読み込み中..."
            : checkedInToday
              ? "本日は付与済みです"
              : isScanning
                ? "読み取り中..."
                : "QRを読み取って入店する"}
        </button>
        {scanMessage && !isProfileLoading ? (
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
        {isProfileLoading ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#d1d5db] bg-white p-3 shadow-sm">
              <div className="flex gap-3">
                <Skeleton className="h-16 w-20 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-[90%]" />
                  <Skeleton className="h-4 w-[65%]" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-md bg-[#f3f4f6] px-3 py-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          </div>
        ) : ownedGifts.length === 0 ? (
          <div className="rounded-xl border border-[#d1d5db] bg-white px-6 py-10 text-center text-[#94a3b8] shadow-sm">
            <p className="text-base">持っている特典がありません</p>
            <p className="mt-4 text-5xl">🎁</p>
            <p className="mt-4 text-sm leading-6">
              会員限定のお得な情報や
              <br />
              特典の配布をおまちください
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {ownedGifts.map((gift) => (
              <article
                key={gift.userGiftId}
                className="rounded-xl border border-[#d1d5db] bg-white p-3 shadow-sm"
              >
                <div className="flex gap-3">
                  <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-[#f3f4f6]">
                    <img src={gift.imageUrl} alt={gift.title} className="h-full w-full object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGift(gift);
                      setArmedUseGiftId(null);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="line-clamp-2 text-lg font-bold leading-snug text-[#111827]">{gift.title}</p>
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-md bg-[#f3f4f6] px-3 py-2">
                  <p className="text-sm text-[#374151]">{formatDateLabel(gift.expiresAt)}まで有効</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGift(gift);
                      setArmedUseGiftId(null);
                    }}
                    className="rounded-md bg-[#14b8a6] px-4 py-2 text-sm font-bold text-white"
                  >
                    特典を使う
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        </section>
      </main>
      {isGachaJudging ? (
        <div className="fixed inset-0 z-55 flex flex-col items-center justify-center gap-3 bg-white/35 backdrop-blur-sm">
          <div
            className="h-10 w-10 animate-spin rounded-full border-4 border-[#0f766e]/25 border-t-[#0f766e]"
            aria-hidden="true"
          />
          <p className="text-sm font-semibold text-[#0f172a]">判定中...</p>
        </div>
      ) : null}
      {gachaPopup.open ? (
        <div className="fixed inset-0 z-56 flex items-center justify-center bg-black/35 px-6">
          <section className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <p className="text-sm font-semibold text-[#64748b]">来店ガチャ結果</p>
            <p className={`mt-3 text-2xl font-bold ${gachaPopup.won ? "text-[#0f766e]" : "text-[#334155]"}`}>
              {gachaPopup.won ? "あたり！" : "ハズレ"}
            </p>
            <p className="mt-3 text-sm text-[#334155]">
              {gachaPopup.won
                ? `「${gachaPopup.giftTitle ?? "ギフト"}」を獲得しました。`
                : "また次回チャレンジしてください。"}
            </p>
            <button
              type="button"
              onClick={handleCloseGachaPopup}
              className="mt-6 w-full rounded-lg bg-[#0f766e] px-4 py-3 text-sm font-bold text-white"
            >
              閉じる
            </button>
          </section>
        </div>
      ) : null}
      {selectedGift ? (
        <div className="fixed inset-0 z-57 flex items-center justify-center bg-black/35 px-6">
          <section className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="aspect-[4/3] w-full overflow-hidden bg-[#f3f4f6]">
              <img src={selectedGift.imageUrl} alt={selectedGift.title} className="h-full w-full object-contain" />
            </div>
            <div className="p-4">
              <p className="text-4 leading-tight font-bold text-[#111827]">{selectedGift.title}</p>
              <p className="mt-2 text-sm font-semibold text-[#374151]">
                {formatDateLabel(selectedGift.expiresAt)} まで有効
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#6b7280]">
                {selectedGift.usageGuide}
              </p>
              <div className="mt-4">
                <div className="relative">
                  {armedUseGiftId === selectedGift.userGiftId ? (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 rounded-md bg-black px-3 py-1 text-xs font-semibold text-white">
                      スタッフに見せてください
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleUseGiftClick(selectedGift)}
                    disabled={isUsingGift}
                    className="w-full rounded-lg bg-[#14b8a6] py-3 text-base font-bold text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
                  >
                    {isUsingGift ? "処理中..." : "特典を使う"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGift(null);
                    setArmedUseGiftId(null);
                  }}
                  className="mt-3 w-full rounded-full bg-[#111827] py-2 text-sm font-bold text-white"
                >
                  × あとで使う
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
      {toastMessage ? (
        <div className="fixed inset-x-0 bottom-24 z-58 mx-auto w-fit rounded-full bg-[#111827] px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
      {needsSurvey && profile ? (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-[#f3f4f7]">
          <div className="mx-auto min-h-screen w-full max-w-md px-6 pb-10 pt-6 text-[#1f2937]">
            <section className="rounded-xl bg-[#d5e8e8] px-4 py-5">
              <p className="text-base font-semibold">アンケート回答で会員登録</p>
            </section>

            <div className="mt-5 flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full bg-[#e5e7eb]">
                <div
                  className="h-2 rounded-full bg-[#14b8a6] transition-all"
                  style={{ width: `${surveyProgressPercent}%` }}
                />
              </div>
              <p className="w-10 text-right text-sm font-semibold text-[#64748b]">{surveyProgress}</p>
            </div>

            <section className="mt-8">
              <h2 className="text-center text-4xl font-bold tracking-tight">
                {surveySteps[surveyStep] === "gender" ? "性別" : null}
                {surveySteps[surveyStep] === "visitFrequency" ? "来店回数" : null}
                {surveySteps[surveyStep] === "companionType" ? "一緒に来店した人" : null}
                {surveySteps[surveyStep] === "birthDate" ? "生年月日" : null}
              </h2>

              <div className="mt-8 space-y-3">
                {surveySteps[surveyStep] === "gender"
                  ? genderOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSurveyForm((prev) => ({ ...prev, gender: option.value }))}
                        className={`w-full rounded-lg border px-4 py-4 text-left text-2xl font-semibold ${
                          surveyForm.gender === option.value
                            ? "border-[#14b8a6] bg-[#d5e8e8] text-[#0f172a]"
                            : "border-[#d1d5db] bg-white text-[#1f2937]"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))
                  : null}

                {surveySteps[surveyStep] === "visitFrequency"
                  ? visitFrequencyOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSurveyForm((prev) => ({ ...prev, visitFrequency: option.value }))}
                        className={`w-full rounded-lg border px-4 py-4 text-left text-2xl font-semibold ${
                          surveyForm.visitFrequency === option.value
                            ? "border-[#14b8a6] bg-[#d5e8e8] text-[#0f172a]"
                            : "border-[#d1d5db] bg-white text-[#1f2937]"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))
                  : null}

                {surveySteps[surveyStep] === "companionType"
                  ? companionOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSurveyForm((prev) => ({ ...prev, companionType: option.value }))}
                        className={`w-full rounded-lg border px-4 py-4 text-left text-2xl font-semibold ${
                          surveyForm.companionType === option.value
                            ? "border-[#14b8a6] bg-[#d5e8e8] text-[#0f172a]"
                            : "border-[#d1d5db] bg-white text-[#1f2937]"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))
                  : null}

                {surveySteps[surveyStep] === "birthDate" ? (
                  <label className="block rounded-lg border border-[#d1d5db] bg-white px-4 py-4">
                    <span className="mb-2 block text-sm font-semibold text-[#64748b]">生年月日を選択</span>
                    <input
                      type="date"
                      max={todayAsYmd()}
                      value={surveyForm.birthDate}
                      onChange={(event) => setSurveyForm((prev) => ({ ...prev, birthDate: event.target.value }))}
                      className="w-full bg-transparent text-2xl font-semibold outline-none"
                    />
                  </label>
                ) : null}
              </div>
            </section>

            {surveyError ? <p className="mt-4 text-sm font-semibold text-[#b91c1c]">{surveyError}</p> : null}

            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={handleSurveyBack}
                disabled={surveyStep === 0 || isSubmittingSurvey}
                className="w-1/3 rounded-lg border border-[#cbd5e1] bg-white py-3 text-sm font-bold text-[#334155] disabled:opacity-40"
              >
                戻る
              </button>
              <button
                type="button"
                onClick={() => void handleSurveyNext()}
                disabled={!canProceedSurveyStep || isSubmittingSurvey}
                className="w-2/3 rounded-lg bg-[#0f9f99] py-3 text-base font-bold text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
              >
                {surveyStep === surveySteps.length - 1
                  ? isSubmittingSurvey
                    ? "送信中..."
                    : "送信"
                  : "次へ"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
