"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import DevUserSwitcher from "@/app/dev-user-switcher";
import { isDevMockLiffEnabled, resolveDevMockUser } from "@/lib/dev-mock-liff";
import { rpcClient, setRpcLiffIdToken } from "@/orpc/client";

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
  resultImageUrl: string | null;
};
type GachaStartPopupState = {
  open: boolean;
  winProbability: number;
  previewGift: {
    title: string;
    usageGuide: string;
    imageUrl: string;
    expiresLabel: string | null;
  } | null;
};
type OwnedGift = {
  userGiftId: string;
  giftId: string;
  title: string;
  usageGuide: string;
  imageUrl: string;
  expiresAt: string;
};

type SurveyQuestionConfig = {
  id: string;
  questionKey: string;
  presetKey: "gender" | "visitFrequency" | "companionType" | "birthDate" | null;
  questionType: "single_select" | "date" | "text";
  label: string;
  options: Array<{ value: string; label: string }>;
  placeholder: string | null;
  isEnabled: boolean;
  isRequired: boolean;
  sortOrder: number;
};
type BirthDateParts = {
  year: string;
  month: string;
  day: string;
};
const defaultSurveyQuestions: SurveyQuestionConfig[] = [
  {
    id: "preset-gender",
    questionKey: "gender",
    presetKey: "gender",
    questionType: "single_select",
    label: "性別",
    options: [
      { value: "male", label: "男性" },
      { value: "female", label: "女性" },
      { value: "other", label: "その他" },
    ],
    placeholder: null,
    isEnabled: true,
    isRequired: true,
    sortOrder: 0,
  },
  {
    id: "preset-visitFrequency",
    questionKey: "visitFrequency",
    presetKey: "visitFrequency",
    questionType: "single_select",
    label: "来店回数(これまで来店した回数)",
    options: [
      { value: "1", label: "1回" },
      { value: "2", label: "2回" },
      { value: "3", label: "3回" },
      { value: "4", label: "4回" },
      { value: "5_plus", label: "5回以上" },
    ],
    placeholder: null,
    isEnabled: true,
    isRequired: true,
    sortOrder: 1,
  },
  {
    id: "preset-companionType",
    questionKey: "companionType",
    presetKey: "companionType",
    questionType: "single_select",
    label: "一緒に来店した人",
    options: [
      { value: "alone", label: "ひとり" },
      { value: "family", label: "家族" },
      { value: "partner_or_friends", label: "友人・パートナー" },
      { value: "coworkers", label: "職場関係" },
      { value: "other", label: "その他" },
    ],
    placeholder: null,
    isEnabled: true,
    isRequired: true,
    sortOrder: 2,
  },
  {
    id: "preset-birthDate",
    questionKey: "birthDate",
    presetKey: "birthDate",
    questionType: "date",
    label: "生年月日",
    options: [],
    placeholder: null,
    isEnabled: true,
    isRequired: true,
    sortOrder: 3,
  },
];
export type PublicStoreProfile = {
  slug: string;
  displayName: string;
  logoUrl: string | null;
  themeColor: string;
  liffId: string | null;
  lineAddFriendUrl: string | null;
  googleReviewUrl: string | null;
  features: {
    rankProgram: boolean;
    reviewCampaign: boolean;
    gifts: boolean;
  };
};

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

function extractBirthDateParts(value: string) {
  const matched = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parts: BirthDateParts = {
    year: matched?.[1] ?? "",
    month: matched?.[2] ?? "",
    day: matched?.[3] ?? "",
  };
  return parts;
}

function getDaysInMonth(year: string, month: string) {
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    return 31;
  }
  return new Date(parsedYear, parsedMonth, 0).getDate();
}

function buildBirthDateFromParts(year: string, month: string, day: string) {
  if (!year || !month || !day) {
    return "";
  }
  return `${year}-${month}-${day}`;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-[#e5e7eb] ${className}`} aria-hidden="true" />;
}

export default function MembershipCard({ store }: { store: PublicStoreProfile }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [points, setPoints] = useState(0);
  const [userRole, setUserRole] = useState<"staff" | null>(null);
  const [isStaffPortal, setIsStaffPortal] = useState(false);
  const [staffStoreIsOpen, setStaffStoreIsOpen] = useState(false);
  const [staffStatusIsAutomatic, setStaffStatusIsAutomatic] = useState(false);
  const [storeIsOpen, setStoreIsOpen] = useState<boolean | null>(null);
  const [staffCanOpen, setStaffCanOpen] = useState(false);
  const [staffCanClose, setStaffCanClose] = useState(false);
  const [isUpdatingStoreStatus, setIsUpdatingStoreStatus] = useState(false);
  const [staffToastMessage, setStaffToastMessage] = useState<string | null>(null);
  const [currentRankName, setCurrentRankName] = useState("レギュラー");
  const [nextRankName, setNextRankName] = useState<string | null>("シルバー");
  const [pointsToNextRank, setPointsToNextRank] = useState(0);
  const [isGachaJudging, setIsGachaJudging] = useState(false);
  const [gachaJudgingLabel, setGachaJudgingLabel] = useState("ポイント付与中...");
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
    resultImageUrl: null,
  });
  const [gachaStartPopup, setGachaStartPopup] = useState<GachaStartPopupState>({
    open: false,
    winProbability: 0,
    previewGift: null,
  });
  const [needsSurvey, setNeedsSurvey] = useState(false);
  const [surveyStep, setSurveyStep] = useState(0);
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestionConfig[]>(defaultSurveyQuestions);
  const [pendingSurvey, setPendingSurvey] = useState(false);
  const [isAutoCheckinProcessing, setIsAutoCheckinProcessing] = useState(false);
  const [isSubmittingSurvey, setIsSubmittingSurvey] = useState(false);
  const [surveyError, setSurveyError] = useState<string | null>(null);
  const [surveyForm, setSurveyForm] = useState<Record<string, string>>({});
  const [birthDateDraft, setBirthDateDraft] = useState<BirthDateParts>({ year: "", month: "", day: "" });
  const [hasGoogleReview, setHasGoogleReview] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isReviewDoneModalOpen, setIsReviewDoneModalOpen] = useState(false);
  const [isReviewPasswordModalOpen, setIsReviewPasswordModalOpen] = useState(false);
  const [reviewPassword, setReviewPassword] = useState("");
  const [isReviewPasswordSubmitting, setIsReviewPasswordSubmitting] = useState(false);
  const [isLineFriend, setIsLineFriend] = useState<boolean | null>(null);
  const [isCheckingFriendship, setIsCheckingFriendship] = useState(false);
  const [friendshipError, setFriendshipError] = useState<string | null>(null);
  const claimedGiftQueryRef = useRef<string | null>(null);
  const autoCheckinTokenRef = useRef<string | null>(null);
  const pendingSurveyRef = useRef(false);
  const liffRef = useRef<{ getFriendship: () => Promise<{ friendFlag: boolean }> } | null>(null);
  const liffId = store.liffId ?? undefined;
  const lineAddFriendUrl = store.lineAddFriendUrl ?? undefined;

  useEffect(() => {
    pendingSurveyRef.current = pendingSurvey;
  }, [pendingSurvey]);

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
    const useDevMock = isDevMockLiffEnabled();

    const applySyncedProfile = async (userProfile: Profile) => {
      setProfile(userProfile);
      const syncResult = await rpcClient.user.upsertFromLiff({
        userId: userProfile.userId,
        displayName: userProfile.displayName,
        pictureUrl: userProfile.pictureUrl,
        storeSlug: store.slug,
      });
      if (cancelled) {
        return;
      }
      setPoints(syncResult.points);
      setUserRole(syncResult.role);
      setCurrentRankName(syncResult.currentRankName);
      setNextRankName(syncResult.nextRankName);
      setPointsToNextRank(syncResult.pointsToNextRank);
      setCheckedInToday(syncResult.checkedInToday);
      setHasGoogleReview(syncResult.hasGoogleReview);
      const publicStoreStatusPromise = rpcClient.user.getStoreStatus({ storeSlug: store.slug });
      if (syncResult.role === "staff") {
        setPendingSurvey(false);
      } else if (syncResult.hasSurvey) {
        setPendingSurvey(false);
      } else {
        const surveyConfigResult = await rpcClient.user.getOnboardingSurveyQuestions({
          storeSlug: store.slug,
        });
        const questions = surveyConfigResult.questions as SurveyQuestionConfig[];
        const activeQuestions = questions
          .filter((question: SurveyQuestionConfig) => question.isEnabled)
          .sort((a: SurveyQuestionConfig, b: SurveyQuestionConfig) => a.sortOrder - b.sortOrder);
        setSurveyQuestions(questions.length > 0 ? questions : defaultSurveyQuestions);
        setPendingSurvey(activeQuestions.length > 0);
      }
      setNeedsSurvey(false);
      if (syncResult.role === "staff") {
        const staffStatus = await rpcClient.user.getStaffStoreStatus({
          userId: userProfile.userId,
          storeSlug: store.slug,
        });
        if (!cancelled) {
          setIsStaffPortal(staffStatus.authorized);
          setStaffStoreIsOpen(staffStatus.isOpen);
          setStaffStatusIsAutomatic(staffStatus.isAutomatic);
          setStaffCanOpen(staffStatus.canOpen);
          setStaffCanClose(staffStatus.canClose);
        }
      } else if (!cancelled) {
        setIsStaffPortal(false);
        setStaffStoreIsOpen(false);
        setStaffCanOpen(false);
        setStaffCanClose(false);
      }
      if (syncResult.signupGiftTitle) {
        setToastMessage(`会員登録特典「${syncResult.signupGiftTitle}」を獲得しました。`);
        setTimeout(() => setToastMessage(null), 2600);
      }
      void fetchOwnedGifts(userProfile.userId);
      if (!cancelled) {
        setIsProfileLoading(false);
      }
      void publicStoreStatusPromise
        .then((publicStoreStatus) => {
          if (!cancelled) {
            setStoreIsOpen(publicStoreStatus.isOpen);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setStoreIsOpen(false);
          }
        });
    };

    const initializeLiff = async () => {
      setIsProfileLoading(true);
      if (useDevMock) {
        try {
          setIsLineFriend(true);
          setFriendshipError(null);
          const mockUser = resolveDevMockUser();
          setRpcLiffIdToken(`dev-mock:${mockUser.userId}:${store.slug}`);
          await applySyncedProfile(mockUser);
        } catch (error) {
          console.error(error);
          if (!cancelled) {
            setIsProfileLoading(false);
          }
        }
        return;
      }

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
        liffRef.current = liff;

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        try {
          const friendship = await liff.getFriendship();
          if (!cancelled) {
            setIsLineFriend(friendship.friendFlag);
            setFriendshipError(null);
          }
        } catch {
          if (!cancelled) {
            setIsLineFriend(null);
            setFriendshipError("友だち状態の確認に失敗しました。再確認をお試しください。");
          }
        }

        const userProfile = await liff.getProfile();
        setRpcLiffIdToken(liff.getIDToken());
        const profileFetchedAt = performance.now();
        if (cancelled) {
          return;
        }

        const syncedAtStarted = performance.now();
        await applySyncedProfile(userProfile);
        console.info("[liff-init-ms]", {
          importLiff: Math.round(importedAt - importStartedAt),
          liffInit: Math.round(initializedAt - importedAt),
          getProfile: Math.round(profileFetchedAt - initializedAt),
          upsertFromLiff: Math.round(performance.now() - syncedAtStarted),
          totalToReady: Math.round(performance.now() - importStartedAt),
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
      liffRef.current = null;
    };
  }, [liffId, store.slug]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void rpcClient.user
        .getStoreStatus({ storeSlug: store.slug })
        .then((status) => {
          setStoreIsOpen(status.isOpen);
          if (userRole === "staff") {
            setStaffStoreIsOpen(status.isOpen);
            setStaffStatusIsAutomatic(status.isAutomatic);
          }
        })
        .catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, [store.slug, userRole]);

  const handleRefreshFriendship = async () => {
    if (isCheckingFriendship || !liffRef.current) return;
    setIsCheckingFriendship(true);
    setFriendshipError(null);
    try {
      const friendship = await liffRef.current.getFriendship();
      setIsLineFriend(friendship.friendFlag);
    } catch {
      setFriendshipError("友だち状態の確認に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsCheckingFriendship(false);
    }
  };

  useEffect(() => {
    if (!profile || typeof window === "undefined") return;
    if (userRole === "staff" || isStaffPortal) {
      // State is synchronized with the authenticated LIFF role.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNeedsSurvey(false);
      return;
    }

    const url = new URL(window.location.href);
    const checkinToken = url.searchParams.get("checkinToken")?.trim() ?? "";
    if (!checkinToken) {
      setNeedsSurvey(pendingSurvey);
      return;
    }
    if (autoCheckinTokenRef.current === checkinToken) {
      setNeedsSurvey(pendingSurvey);
      return;
    }
    autoCheckinTokenRef.current = checkinToken;

    // 同日付与済みならAPIを叩かず即時終了する
    if (checkedInToday) {
      url.searchParams.delete("checkinToken");
      window.history.replaceState({}, "", url.toString());
      setNeedsSurvey(pendingSurveyRef.current);
      return;
    }

    const runAutoCheckin = async () => {
      setIsAutoCheckinProcessing(true);
      setScanMessage("来店ポイントを付与しています...");
      setGachaStartPopup({ open: false, winProbability: 0, previewGift: null });
      setGachaPopup({ open: false, won: false, giftTitle: null, resultImageUrl: null });
      try {
        setGachaJudgingLabel("ポイント付与中...");
        setIsGachaJudging(true);
        const result = await rpcClient.user.addVisitPoint({
          userId: profile.userId,
          qrValue: checkinToken,
        });
        setPoints(result.points);
        setCurrentRankName(result.currentRankName);
        setNextRankName(result.nextRankName);
        setPointsToNextRank(result.pointsToNextRank);
        setCheckedInToday(result.checkedInToday);
        if (result.alreadyCheckedInToday) {
          return;
        }
        const giftSuffix =
          result.grantedGiftTitles.length > 0
            ? ` 特典「${result.grantedGiftTitles.join(" / ")}」を獲得しました。`
            : "";
        if (result.gacha?.eligible) {
          setGachaStartPopup({
            open: true,
            winProbability: result.gacha.winProbability,
            previewGift: result.gacha.previewGift ?? null,
          });
          setScanMessage(`+1ポイントを付与しました。${giftSuffix}ガチャにチャレンジしてください。`);
        } else {
          setScanMessage(`+1ポイントを付与しました。${giftSuffix}`.trim());
        }
        await fetchOwnedGifts(profile.userId);
      } catch (error) {
        setScanMessage(error instanceof Error ? error.message : "ポイント付与に失敗しました。");
      } finally {
        setIsGachaJudging(false);
        setIsAutoCheckinProcessing(false);
        url.searchParams.delete("checkinToken");
        window.history.replaceState({}, "", url.toString());
        setNeedsSurvey(pendingSurveyRef.current);
      }
    };

    void runAutoCheckin();
  }, [checkedInToday, isStaffPortal, pendingSurvey, profile, userRole]);

  useEffect(() => {
    const claimGiftFromQuery = async () => {
      if (!profile) return;
      if (typeof window === "undefined") return;
      const giftId = new URLSearchParams(window.location.search).get("giftId");
      if (!giftId) return;
      if (claimedGiftQueryRef.current === giftId) return;
      claimedGiftQueryRef.current = giftId;

      setScanMessage("giftを獲得中...");
      try {
        const result = await rpcClient.user.claimGiftFromLink({
          userId: profile.userId,
          giftId,
        });
        if (result.alreadyClaimed) {
          setToastMessage(`「${result.giftTitle}」は既に獲得済みです。`);
          setScanMessage("このギフトは既に獲得済みです。");
        } else {
          setToastMessage(`「${result.giftTitle}」を獲得しました。`);
          setScanMessage("ギフトを獲得しました。");
        }
        setTimeout(() => setToastMessage(null), 2200);
        await fetchOwnedGifts(profile.userId);
        const url = new URL(window.location.href);
        url.searchParams.delete("giftId");
        window.history.replaceState({}, "", url.toString());
      } catch (error) {
        setScanMessage(error instanceof Error ? error.message : "ギフトの獲得に失敗しました。");
      }
    };
    void claimGiftFromQuery();
  }, [profile]);

  const progressToNextRank =
    nextRankName === null ? 100 : Math.min(((points + pointsToNextRank) === 0 ? 0 : (points / (points + pointsToNextRank)) * 100), 100);
  const surveySteps = surveyQuestions
    .filter((question) => question.isEnabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const activeSurveyStep = Math.min(surveyStep, Math.max(surveySteps.length - 1, 0));
  const currentSurveyQuestion = surveySteps[activeSurveyStep] ?? null;
  const surveyProgress = `${Math.min(activeSurveyStep + 1, Math.max(surveySteps.length, 1))}/${Math.max(surveySteps.length, 1)}`;
  const surveyProgressPercent = (Math.min(activeSurveyStep + 1, Math.max(surveySteps.length, 1)) / Math.max(surveySteps.length, 1)) * 100;
  const currentYear = new Date().getFullYear();
  const birthYearOptions = Array.from({ length: currentYear - 1900 + 1 }, (_, index) => String(currentYear - index));
  const birthMonthOptions = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
  const birthDateParts = birthDateDraft;
  const birthDayOptions = Array.from(
    { length: getDaysInMonth(birthDateParts.year, birthDateParts.month) },
    (_, index) => String(index + 1).padStart(2, "0"),
  );

  useEffect(() => {
    if (!currentSurveyQuestion || currentSurveyQuestion.presetKey !== "birthDate") return;
    const stored = surveyForm[currentSurveyQuestion.questionKey] ?? "";
    if (!stored) return;
    const parsed = extractBirthDateParts(stored);
    if (!parsed.year || !parsed.month || !parsed.day) return;
    if (
      parsed.year !== birthDateDraft.year ||
      parsed.month !== birthDateDraft.month ||
      parsed.day !== birthDateDraft.day
    ) {
      // Keep the segmented date inputs aligned with the stored survey answer.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBirthDateDraft(parsed);
    }
  }, [birthDateDraft.day, birthDateDraft.month, birthDateDraft.year, currentSurveyQuestion, surveyForm]);

  const canProceedSurveyStep = (() => {
    if (!currentSurveyQuestion) return true;
    if (!currentSurveyQuestion.isRequired) return true;
    const value = surveyForm[currentSurveyQuestion.questionKey] ?? "";
    return value.trim().length > 0;
  })();

  const handleSurveyNext = async () => {
    if (!profile || !currentSurveyQuestion || !canProceedSurveyStep) return;
    setSurveyError(null);

    if (activeSurveyStep < surveySteps.length - 1) {
      setSurveyStep((prev) => prev + 1);
      return;
    }

    setIsSubmittingSurvey(true);
    try {
      const answers = surveySteps
        .map((question) => ({
          questionKey: question.questionKey,
          value: (surveyForm[question.questionKey] ?? "").trim(),
        }))
        .filter((answer) => answer.value.length > 0);
      await rpcClient.user.submitOnboardingSurvey({
        userId: profile.userId,
        answers,
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

  const handleCloseGachaPopup = () => {
    setGachaPopup((prev) => ({ ...prev, open: false }));
  };

  const handleStartGachaChallenge = async () => {
    if (!profile) return;
    const judgingStartedAt = Date.now();
    setGachaStartPopup((prev) => ({ ...prev, open: false }));
    setGachaJudgingLabel("判定中...");
    setIsGachaJudging(true);
    try {
      const result = await rpcClient.user.challengeVisitGacha({
        userId: profile.userId,
      });
      if (result.alreadyChallengedToday) {
        setScanMessage("本日のガチャは実施済みです。");
        return;
      }
      if (!result.executed) {
        setScanMessage("本日はガチャを実行できません。");
        return;
      }
      setGachaPopup({
        open: true,
        won: result.won,
        giftTitle: result.giftTitle ?? null,
        resultImageUrl: result.resultImageUrl ?? null,
      });
      if (result.giftTitle) {
        await fetchOwnedGifts(profile.userId);
      }
    } catch (error) {
      setScanMessage(error instanceof Error ? error.message : "ガチャの実行に失敗しました。");
    } finally {
      const elapsedMs = Date.now() - judgingStartedAt;
      const minJudgingMs = 3000;
      if (elapsedMs < minJudgingMs) {
        await wait(minJudgingMs - elapsedMs);
      }
      setIsGachaJudging(false);
      setGachaJudgingLabel("ポイント付与中...");
    }
  };

  const handleSubmitReviewPassword = async () => {
    if (!profile) return;
    if (!/^\d{4}$/.test(reviewPassword)) {
      setToastMessage("4桁のパスワードを入力してください。");
      setTimeout(() => setToastMessage(null), 2200);
      return;
    }
    setIsReviewPasswordSubmitting(true);
    try {
      const result = await rpcClient.user.claimReviewGiftWithPassword({
        userId: profile.userId,
        password: reviewPassword,
      });
      if (result.alreadyReviewed) {
        setToastMessage("口コミ特典は付与済みです。");
      } else if (result.giftTitle) {
        setToastMessage(`口コミ特典「${result.giftTitle}」を獲得しました。`);
      } else {
        setToastMessage("口コミ特典を反映しました。");
      }
      setTimeout(() => setToastMessage(null), 2400);
      setHasGoogleReview(true);
      setIsReviewPasswordModalOpen(false);
      setReviewPassword("");
      await fetchOwnedGifts(profile.userId);
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : "口コミ特典の反映に失敗しました。");
      setTimeout(() => setToastMessage(null), 2400);
    } finally {
      setIsReviewPasswordSubmitting(false);
    }
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

  const handleStaffStoreToggle = async () => {
    if (!profile || isUpdatingStoreStatus) return;
    const action: "open" | "close" = staffStoreIsOpen ? "close" : "open";
    setIsUpdatingStoreStatus(true);
    try {
      const result = await rpcClient.user.toggleStaffStoreStatus({
        userId: profile.userId,
        action,
        storeSlug: store.slug,
      });
      setStaffStoreIsOpen(result.isOpen);
      setStaffToastMessage(result.isOpen ? "開店しました。" : "閉店しました。");
      setTimeout(() => setStaffToastMessage(null), 2200);
    } catch (error) {
      setStaffToastMessage(error instanceof Error ? error.message : "店舗状態の更新に失敗しました。");
      setTimeout(() => setStaffToastMessage(null), 2200);
    } finally {
      setIsUpdatingStoreStatus(false);
    }
  };

  const showDevUserSwitcher = isDevMockLiffEnabled() && Boolean(profile);

  if (!isProfileLoading && isStaffPortal && userRole === "staff") {
    const canToggle = staffStoreIsOpen ? staffCanClose : staffCanOpen;
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center bg-[#f3f4f7] px-6 pb-28 text-[#1f2937]">
        {showDevUserSwitcher && profile ? <DevUserSwitcher currentUserId={profile.userId} /> : null}
        <section className="w-full rounded-2xl bg-white px-6 py-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-[#0f766e]">STAFF MODE</p>
          <h1 className="mt-2 text-2xl font-bold">スタッフアカウントです</h1>
          <p className="mt-3 text-base font-semibold text-[#0f172a]">
            現在: {staffStoreIsOpen ? "開店中" : "閉店中"}
          </p>
          <p className="mt-3 text-sm leading-6 text-[#64748b]">
            {staffStatusIsAutomatic
              ? "営業時間設定をもとに自動で切り替わります。"
              : "店舗の状態を切り替えると、会員向け画面の営業状態に反映できます。"}
          </p>
          {!staffStatusIsAutomatic ? (
            <>
              <button
                type="button"
                onClick={() => void handleStaffStoreToggle()}
                disabled={!canToggle || isUpdatingStoreStatus}
                className="mt-5 w-full rounded-lg bg-[#0f766e] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
              >
                {isUpdatingStoreStatus
                  ? "更新中..."
                  : staffStoreIsOpen
                    ? "閉店する"
                    : "開店する"}
              </button>
              {!canToggle ? (
                <p className="mt-2 text-xs text-[#b91c1c]">
                  {staffStoreIsOpen ? "閉店権限がありません。" : "開店権限がありません。"}
                </p>
              ) : null}
            </>
          ) : null}
          {staffToastMessage ? (
            <p className="mt-3 text-xs font-semibold text-[#334155]">{staffToastMessage}</p>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <div className="relative">
      {showDevUserSwitcher && profile ? <DevUserSwitcher currentUserId={profile.userId} /> : null}
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#f3f4f7] px-4 pb-24 font-sans text-[#1f2937]">
        <div className="relative -mx-4 bg-white px-4 pt-4 pb-0">
        <div className="relative -mx-4 px-4 pb-0">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-36 rounded-t-[100%] bg-[#f3f4f7]"
        />
        {storeIsOpen === null ? (
          <Skeleton className="relative z-10 mx-auto mb-3 h-9 w-[76%]" />
        ) : (
          <div
            className={`relative z-10 mx-auto mb-3 w-[76%] rounded-lg py-2 text-center text-sm font-bold text-white ${
              storeIsOpen ? "bg-[#16a34a]" : "bg-[#dc2626]"
            }`}
          >
            {storeIsOpen ? "開店中" : "閉店中"}
          </div>
        )}
        <section
          className="relative z-10 mx-auto h-[160px] w-[76%] rounded-xl p-5 text-white shadow-md"
          style={{ backgroundColor: store.themeColor }}
        >
          <p className="text-sm font-semibold">{store.displayName}</p>
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
          ) : store.features.rankProgram ? (
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
          ) : (
            <div className="mt-12 flex items-end justify-between text-sm">
              <p>{profile?.displayName ?? "ゲスト"}</p>
              <p className="text-base font-bold">{points}P</p>
            </div>
          )}
        </section>
        </div>
      </div>

      {store.features.rankProgram ? (
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
        {scanMessage && !isProfileLoading ? (
          <p className="mt-2 text-center text-xs text-[#334155]" aria-live="polite">
            {scanMessage}
          </p>
        ) : null}
        <div className="-mx-5 mt-5 border-t border-[#d1d5db]">
          <Link
            href={`/s/${store.slug}/benefits`}
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
      ) : null}
      {store.features.reviewCampaign && !isProfileLoading && !hasGoogleReview ? (
        <section className="mt-4 w-[94%] mx-auto overflow-hidden rounded-xl border border-[#99f6e4] bg-white shadow-sm">
          <div className="bg-[#ccfbf1] px-4 py-2 text-center text-xs font-bold text-[#0f766e]">
            口コミキャンペーン
          </div>
          <div className="px-5 py-4">
            <p className="text-center text-1xl font-bold leading-tight text-[#0f172a]">
              口コミを書いたら
              <br />
              <span className="text-[#0f766e]">特典をプレゼント！</span>
            </p>
            <button
              type="button"
              onClick={() => {
                setIsReviewModalOpen(true);
              }}
              className="mt-4 flex w-full items-center justify-center rounded-lg bg-[#14b8a6] px-4 py-3 text-sm font-bold text-white"
            >
              口コミを書く
            </button>
          </div>
        </section>
      ) : null}
      {!isProfileLoading && isLineFriend === false ? (
        <section className="mt-4 w-[94%] mx-auto overflow-hidden rounded-xl border border-[#bfdbfe] bg-white shadow-sm">
          <div className="bg-[#dbeafe] px-4 py-2 text-center text-xs font-bold text-[#1d4ed8]">
            公式LINE 友だち追加のお願い
          </div>
          <div className="px-5 py-4">
            <p className="text-center text-sm leading-6 text-[#1e3a8a]">
              友だち追加で最新情報やキャンペーンを受け取れます。
              <br />
              下のボタンから追加後に「再確認」を押してください。
            </p>
            {lineAddFriendUrl ? (
              <a
                href={lineAddFriendUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex w-full items-center justify-center rounded-lg bg-[#2563eb] px-4 py-3 text-sm font-bold text-white"
              >
                友だち追加する
              </a>
            ) : (
              <p className="mt-4 text-center text-sm font-semibold text-[#b91c1c]">
                友だち追加URLが未設定です。店舗管理画面から設定してください。
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleRefreshFriendship()}
              disabled={isCheckingFriendship}
              className="mt-3 w-full rounded-lg border border-[#bfdbfe] py-3 text-sm font-bold text-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCheckingFriendship ? "確認中..." : "友だち追加済みか再確認"}
            </button>
            {friendshipError ? (
              <p className="mt-2 text-center text-xs font-semibold text-[#b91c1c]">{friendshipError}</p>
            ) : null}
          </div>
        </section>
      ) : null}
      {store.features.gifts || ownedGifts.length > 0 ? (
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
      ) : null}
      </main>
      {isGachaJudging ? (
        <div className="fixed inset-0 z-55 flex flex-col items-center justify-center gap-3 bg-white/35 backdrop-blur-sm">
          <div
            className="h-10 w-10 animate-spin rounded-full border-4 border-[#0f766e]/25 border-t-[#0f766e]"
            aria-hidden="true"
          />
          <p className="text-sm font-semibold text-[#0f172a]">{gachaJudgingLabel}</p>
        </div>
      ) : null}
      {gachaPopup.open ? (
        <div className="fixed inset-0 z-56 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md">
            {gachaPopup.resultImageUrl ? (
              <img
                src={gachaPopup.resultImageUrl}
                alt={gachaPopup.won ? "あたり画像" : "ハズレ画像"}
                className="w-full rounded-xl object-contain shadow-xl"
              />
            ) : (
              <div className="rounded-xl bg-white px-6 py-8 text-center shadow-xl">
                <p className={`text-2xl font-bold ${gachaPopup.won ? "text-[#0f766e]" : "text-[#334155]"}`}>
                  {gachaPopup.won ? "あたり！" : "ハズレ"}
                </p>
                <p className="mt-3 text-sm text-[#334155]">
                  {gachaPopup.won
                    ? `「${gachaPopup.giftTitle ?? "ギフト"}」を獲得しました。`
                    : "また次回チャレンジしてください。"}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={handleCloseGachaPopup}
              aria-label="閉じる"
              className="mx-auto mt-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl font-bold text-[#111827] shadow-lg"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
      {gachaStartPopup.open ? (
        <div className="fixed inset-0 z-56 flex items-center justify-center bg-black/35 px-6">
          <div className="w-full max-w-[20rem]">
            <p className="mx-auto w-fit rounded-full bg-white px-4 py-1 text-base font-bold text-[#0f172a]">
              来店するたびチャレンジ
            </p>
            <p className="mt-2 text-center text-[18px] font-extrabold leading-tight text-white drop-shadow">
              あたりがでたら特典GET
            </p>
            <section className="mt-3 overflow-hidden rounded-2xl bg-white shadow-xl">
              <div className="bg-[#dff3eb] p-4">
                {gachaStartPopup.previewGift?.imageUrl ? (
                  <img
                    src={gachaStartPopup.previewGift.imageUrl}
                    alt={gachaStartPopup.previewGift.title}
                    className="h-56 w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-56 w-full items-center justify-center rounded-lg bg-[#c8e8dc] text-lg font-bold text-[#10b981]">
                    ガチャ特典
                  </div>
                )}
              </div>
              <div className="px-5 pb-5 pt-4">
                <p className="text-5 leading-tight font-bold text-[#0f172a]">
                  {gachaStartPopup.previewGift?.title ?? "ガチャ特典"}
                </p>
                {gachaStartPopup.previewGift?.expiresLabel ? (
                  <p className="mt-2 text-sm text-[#334155]">{gachaStartPopup.previewGift.expiresLabel}</p>
                ) : null}
                {gachaStartPopup.previewGift?.usageGuide ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#6b7280]">
                    {gachaStartPopup.previewGift.usageGuide}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={handleStartGachaChallenge}
                  className="mt-5 w-full rounded-lg bg-[#f43f5e] py-3 text-base font-bold text-white"
                >
                  抽選にチャレンジ
                </button>
              </div>
            </section>
            <p className="pt-3 text-center text-sm font-semibold text-white drop-shadow">
              ※当選確率は{gachaStartPopup.winProbability}%です
            </p>
          </div>
        </div>
      ) : null}
      {selectedGift ? (
        <div className="fixed inset-0 z-57 flex items-center justify-center bg-black/35 px-6">
          <section className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="aspect-4/3 w-full overflow-hidden bg-[#f3f4f6]">
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
      {isReviewModalOpen ? (
        <div className="fixed inset-0 z-59 flex items-center justify-center bg-black/35 px-6">
          <section className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-center text-lg font-bold text-[#0f172a]">口コミ投稿のご案内</h3>
            <p className="mt-3 text-center text-sm leading-6 text-[#475569]">
              1. Googleで口コミを投稿
              <br />
              2. 投稿後にこの画面をスタッフへ提示
            </p>
            <a
              href={store.googleReviewUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                setIsReviewModalOpen(false);
                setIsReviewDoneModalOpen(true);
              }}
              className="mt-4 flex w-full items-center justify-center rounded-lg bg-[#14b8a6] py-3 text-sm font-bold text-white"
            >
              Googleで口コミを書く
            </a>
            <button
              type="button"
              onClick={() => {
                setIsReviewModalOpen(false);
                setIsReviewDoneModalOpen(true);
              }}
              className="mt-3 w-full rounded-lg border border-[#cbd5e1] py-2 text-sm font-semibold text-[#334155]"
            >
              閉じる
            </button>
          </section>
        </div>
      ) : null}
      {isReviewDoneModalOpen ? (
        <div className="fixed inset-0 z-59 flex items-center justify-center bg-black/35 px-6">
          <section className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl">
            <h3 className="text-lg font-bold text-[#0f172a]">口コミ投稿ありがとうございます</h3>
            <p className="mt-2 text-sm text-[#64748b]">
              投稿後に口コミをスタッフに見せてね
            </p>
            <button
              type="button"
              onClick={() => {
                setIsReviewDoneModalOpen(false);
                setIsReviewPasswordModalOpen(true);
              }}
              className="mt-5 w-full rounded-lg bg-[#0f766e] py-3 text-sm font-bold text-white"
            >
              完了
            </button>
          </section>
        </div>
      ) : null}
      {isReviewPasswordModalOpen ? (
        <div className="fixed inset-0 z-59 flex items-center justify-center bg-black/35 px-6">
          <section className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl">
            <h3 className="text-lg font-bold text-[#0f172a]">確認用パスワードを入力</h3>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              pattern="[0-9]*"
              value={reviewPassword}
              onChange={(event) => setReviewPassword(event.target.value.replace(/\D/g, "").slice(0, 4))}
              className="mt-4 w-full rounded-lg border border-[#cbd5e1] px-3 py-3 text-center text-xl tracking-[0.3em] text-[#0f172a] outline-none focus:border-[#14b8a6]"
            />
            <button
              type="button"
              onClick={() => void handleSubmitReviewPassword()}
              disabled={isReviewPasswordSubmitting}
              className="mt-4 w-full rounded-lg bg-[#0f766e] py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
            >
              {isReviewPasswordSubmitting ? "反映中..." : "特典を反映する"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsReviewPasswordModalOpen(false);
                setReviewPassword("");
              }}
              disabled={isReviewPasswordSubmitting}
              className="mt-3 w-full rounded-lg border border-[#cbd5e1] py-2 text-sm font-semibold text-[#334155] disabled:opacity-50"
            >
              閉じる
            </button>
          </section>
        </div>
      ) : null}
      {toastMessage ? (
        <div className="fixed inset-x-0 bottom-24 z-58 mx-auto w-fit rounded-full bg-[#111827] px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
      {needsSurvey && profile && !isAutoCheckinProcessing ? (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-[#f7f8fa]">
          <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-5 text-[#1f2937]">
            <header className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[15px] font-bold text-[#1f2937]">会員登録アンケート</p>
                  <p className="mt-0.5 text-xs text-[#64748b]">あと少しで会員証をご利用いただけます</p>
                </div>
                <p className="shrink-0 text-xs font-semibold text-[#64748b]">
                  {activeSurveyStep + 1} / {surveySteps.length}
                </p>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e5e7eb]">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${surveyProgressPercent}%`,
                    backgroundColor: store.themeColor,
                  }}
                />
              </div>
            </header>

            <section className="flex-1 py-7">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#94a3b8]">
                Question {surveyProgress}
              </p>
              <h2 className="mt-2 text-[26px] font-bold leading-tight tracking-tight">
                {currentSurveyQuestion?.label ?? "アンケート"}
              </h2>

              <div className="mt-6 space-y-2.5">
                {currentSurveyQuestion?.questionType === "single_select"
                  ? currentSurveyQuestion.options.map((option) => {
                      const isSelected =
                        (surveyForm[currentSurveyQuestion.questionKey] ?? "") === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setSurveyForm((prev) => ({
                              ...prev,
                              [currentSurveyQuestion.questionKey]: option.value,
                            }))
                          }
                          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-left text-base font-semibold shadow-sm transition"
                          style={
                            isSelected
                              ? {
                                  borderColor: store.themeColor,
                                  backgroundColor: `color-mix(in srgb, ${store.themeColor} 9%, white)`,
                                }
                              : { borderColor: "#e2e8f0" }
                          }
                        >
                          <span>{option.label}</span>
                          <span
                            className="flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold text-white"
                            style={
                              isSelected
                                ? {
                                    borderColor: store.themeColor,
                                    backgroundColor: store.themeColor,
                                  }
                                : { borderColor: "#cbd5e1" }
                            }
                            aria-hidden="true"
                          >
                            {isSelected ? "✓" : ""}
                          </span>
                        </button>
                      );
                    })
                  : null}

                {currentSurveyQuestion?.questionType === "date" ? (
                  currentSurveyQuestion.presetKey === "birthDate" ? (
                    <label className="block rounded-xl border border-[#e2e8f0] bg-white px-4 py-4 shadow-sm">
                      <span className="mb-2 block text-sm font-semibold text-[#64748b]">生年月日を選択</span>
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          value={birthDateParts.year}
                          onChange={(event) => {
                            const nextYear = event.target.value;
                            const maxDay = getDaysInMonth(nextYear, birthDateParts.month);
                            const currentDay = Number(birthDateParts.day);
                            const nextDay =
                              birthDateParts.day.length > 0
                                ? String(Math.min(Number.isNaN(currentDay) ? maxDay : currentDay, maxDay)).padStart(2, "0")
                                : "";
                            const nextParts: BirthDateParts = {
                              year: nextYear,
                              month: birthDateParts.month,
                              day: nextDay,
                            };
                            setBirthDateDraft(nextParts);
                            setSurveyForm((prev) => ({
                              ...prev,
                              [currentSurveyQuestion.questionKey]: buildBirthDateFromParts(
                                nextParts.year,
                                nextParts.month,
                                nextParts.day,
                              ),
                            }));
                          }}
                          className="w-full rounded-lg border border-[#d1d5db] bg-white px-2 py-2.5 text-sm font-semibold outline-none"
                        >
                          <option value="">年</option>
                          {birthYearOptions.map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                        <select
                          value={birthDateParts.month}
                          onChange={(event) => {
                            const nextMonth = event.target.value;
                            const maxDay = getDaysInMonth(birthDateParts.year, nextMonth);
                            const currentDay = Number(birthDateParts.day);
                            const nextDay =
                              birthDateParts.day.length > 0
                                ? String(Math.min(Number.isNaN(currentDay) ? maxDay : currentDay, maxDay)).padStart(2, "0")
                                : "";
                            const nextParts: BirthDateParts = {
                              year: birthDateParts.year,
                              month: nextMonth,
                              day: nextDay,
                            };
                            setBirthDateDraft(nextParts);
                            setSurveyForm((prev) => ({
                              ...prev,
                              [currentSurveyQuestion.questionKey]: buildBirthDateFromParts(
                                nextParts.year,
                                nextParts.month,
                                nextParts.day,
                              ),
                            }));
                          }}
                          className="w-full rounded-lg border border-[#d1d5db] bg-white px-2 py-2.5 text-sm font-semibold outline-none"
                        >
                          <option value="">月</option>
                          {birthMonthOptions.map((month) => (
                            <option key={month} value={month}>
                              {month}
                            </option>
                          ))}
                        </select>
                        <select
                          value={birthDateParts.day}
                          onChange={(event) => {
                            const nextParts: BirthDateParts = {
                              year: birthDateParts.year,
                              month: birthDateParts.month,
                              day: event.target.value,
                            };
                            setBirthDateDraft(nextParts);
                            setSurveyForm((prev) => ({
                              ...prev,
                              [currentSurveyQuestion.questionKey]: buildBirthDateFromParts(
                                nextParts.year,
                                nextParts.month,
                                nextParts.day,
                              ),
                            }));
                          }}
                          className="w-full rounded-lg border border-[#d1d5db] bg-white px-2 py-2.5 text-sm font-semibold outline-none"
                        >
                          <option value="">日</option>
                          {birthDayOptions.map((day) => (
                            <option key={day} value={day}>
                              {day}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>
                  ) : (
                    <label className="block rounded-xl border border-[#e2e8f0] bg-white px-4 py-4 shadow-sm">
                      <span className="mb-2 block text-sm font-semibold text-[#64748b]">日付を選択</span>
                      <input
                        type="date"
                        max={todayAsYmd()}
                        value={surveyForm[currentSurveyQuestion.questionKey] ?? ""}
                        onChange={(event) =>
                          setSurveyForm((prev) => ({
                            ...prev,
                            [currentSurveyQuestion.questionKey]: event.target.value,
                          }))
                        }
                        className="w-full bg-transparent text-base font-semibold outline-none"
                      />
                    </label>
                  )
                ) : null}

                {currentSurveyQuestion?.questionType === "text" ? (
                  <label className="block rounded-xl border border-[#e2e8f0] bg-white px-4 py-4 shadow-sm">
                    <span className="mb-2 block text-sm font-semibold text-[#64748b]">{currentSurveyQuestion.label}</span>
                    <textarea
                      value={surveyForm[currentSurveyQuestion.questionKey] ?? ""}
                      onChange={(event) =>
                        setSurveyForm((prev) => ({
                          ...prev,
                          [currentSurveyQuestion.questionKey]: event.target.value,
                        }))
                      }
                      placeholder={currentSurveyQuestion.placeholder ?? "自由に入力してください"}
                      className="min-h-24 w-full resize-y bg-transparent text-base font-medium outline-none"
                    />
                  </label>
                ) : null}
              </div>
            </section>

            {surveyError ? <p className="mb-3 text-sm font-semibold text-[#b91c1c]">{surveyError}</p> : null}

            <div className="sticky bottom-0 -mx-5 mt-auto flex gap-3 border-t border-[#e5e7eb] bg-white/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
              <button
                type="button"
                onClick={handleSurveyBack}
                disabled={activeSurveyStep === 0 || isSubmittingSurvey}
                className="w-1/3 rounded-xl border border-[#cbd5e1] bg-white py-3 text-sm font-bold text-[#334155] disabled:opacity-40"
              >
                戻る
              </button>
              <button
                type="button"
                onClick={() => void handleSurveyNext()}
                disabled={!canProceedSurveyStep || isSubmittingSurvey}
                className="w-2/3 rounded-xl py-3 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
                style={
                  canProceedSurveyStep && !isSubmittingSurvey
                    ? { backgroundColor: store.themeColor }
                    : undefined
                }
              >
                {activeSurveyStep === surveySteps.length - 1
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
