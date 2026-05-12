"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";

type GiftOption = {
  id: string;
  title: string;
};

type RankOption = {
  id: string;
  name: string;
};

type InitialSetting = {
  giftId: string;
  winImageUrl: string | null;
  loseImageUrl: string | null;
  winProbability: number;
  isActive: boolean;
  rankProbabilities: Array<{
    rankId: string;
    winProbability: number;
  }>;
} | null;

type Props = {
  gifts: GiftOption[];
  ranks: RankOption[];
  initialSetting: InitialSetting;
};

export default function VisitGachaClient({ gifts, ranks, initialSetting }: Props) {
  const [giftId, setGiftId] = useState(initialSetting?.giftId ?? "");
  const [winImageUrl, setWinImageUrl] = useState(initialSetting?.winImageUrl ?? "");
  const [loseImageUrl, setLoseImageUrl] = useState(initialSetting?.loseImageUrl ?? "");
  const [winProbability, setWinProbability] = useState(String(initialSetting?.winProbability ?? 20));
  const [rankWinProbabilities, setRankWinProbabilities] = useState<Record<string, string>>(() => {
    const entries = initialSetting?.rankProbabilities.map((row) => [row.rankId, String(row.winProbability)]) ?? [];
    return Object.fromEntries(entries);
  });
  const [isActive, setIsActive] = useState(initialSetting?.isActive ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingWinImage, setIsUploadingWinImage] = useState(false);
  const [isUploadingLoseImage, setIsUploadingLoseImage] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const loseProbability = useMemo(() => {
    const value = Number(winProbability);
    if (!Number.isFinite(value)) return null;
    return Math.max(0, 100 - value);
  }, [winProbability]);

  const canSubmit = useMemo(() => {
    const value = Number(winProbability);
    if (!(giftId.length > 0 && Number.isInteger(value) && value >= 0 && value <= 100)) {
      return false;
    }
    return ranks.every((rank) => {
      const raw = rankWinProbabilities[rank.id];
      if (!raw || raw.trim().length === 0) {
        return true;
      }
      const rankValue = Number(raw);
      return Number.isInteger(rankValue) && rankValue >= 0 && rankValue <= 100;
    });
  }, [giftId, rankWinProbabilities, ranks, winProbability]);

  const handleResultImageUpload = async (
    event: ChangeEvent<HTMLInputElement>,
    type: "win" | "lose",
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage(null);
    setIsError(false);
    if (type === "win") {
      setIsUploadingWinImage(true);
    } else {
      setIsUploadingLoseImage(true);
    }
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/gifts/upload", {
        method: "POST",
        body: formData,
      });
      const json = (await response.json()) as {
        ok: boolean;
        imagePath?: string;
        previewUrl?: string;
        message?: string;
      };
      if (!response.ok || !json.ok || !json.imagePath) {
        setIsError(true);
        setMessage(json.message ?? "画像アップロードに失敗しました。");
        return;
      }
      if (type === "win") {
        setWinImageUrl(json.imagePath);
      } else {
        setLoseImageUrl(json.imagePath);
      }
      setMessage("ガチャ結果画像をアップロードしました。");
    } catch {
      setIsError(true);
      setMessage("画像アップロード時に通信エラーが発生しました。");
    } finally {
      if (type === "win") {
        setIsUploadingWinImage(false);
      } else {
        setIsUploadingLoseImage(false);
      }
      event.target.value = "";
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isSaving) return;

    setIsSaving(true);
    setMessage(null);
    setIsError(false);
    try {
      const response = await fetch("/api/admin/visit-gacha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          giftId,
          winImageUrl: winImageUrl.trim().length > 0 ? winImageUrl.trim() : null,
          loseImageUrl: loseImageUrl.trim().length > 0 ? loseImageUrl.trim() : null,
          winProbability: Number(winProbability),
          rankWinProbabilities: ranks
            .map((rank) => {
              const raw = rankWinProbabilities[rank.id]?.trim() ?? "";
              if (!raw) return null;
              return {
                rankId: rank.id,
                winProbability: Number(raw),
              };
            })
            .filter((row): row is { rankId: string; winProbability: number } => row !== null),
          isActive,
        }),
      });
      const json = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !json.ok) {
        setIsError(true);
        setMessage(json.message ?? "来店ガチャ設定の保存に失敗しました。");
        return;
      }
      setMessage("来店ガチャ設定を保存しました。");
    } catch {
      setIsError(true);
      setMessage("通信エラーが発生しました。");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full space-y-4 p-4">
      <h1 className="mx-auto w-[90%] text-xl font-bold">来店ガチャ</h1>

      <section className="mx-auto w-[90%] rounded-xl border border-[#dbe2ea] bg-white p-4 shadow-sm">
        <h2 className="font-bold">ガチャ設定</h2>
        <p className="mt-1 text-sm text-[#64748b]">
          QRコード来店ポイント付与時に実行されるガチャの当選条件を設定します。
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#334155]">当選ギフト</span>
            <select
              value={giftId}
              onChange={(event) => setGiftId(event.target.value)}
              className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 outline-none focus:border-[#0f766e]"
            >
              <option value="">ギフトを選択</option>
              {gifts.map((gift) => (
                <option key={gift.id} value={gift.id}>
                  {gift.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#334155]">当選確率 (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={winProbability}
              onChange={(event) => setWinProbability(event.target.value)}
              className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 outline-none focus:border-[#0f766e]"
              placeholder="0-100"
            />
            <p className="mt-1 text-xs text-[#64748b]">
              {loseProbability === null ? "0〜100の整数で入力してください。" : `ハズレ確率: ${loseProbability}%`}
            </p>
          </label>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-[#334155]">結果画像</p>
            <label className="block">
              <span className="mb-1 block text-sm text-[#334155]">当たり画像URL（任意）</span>
              <input
                type="url"
                value={winImageUrl}
                onChange={(event) => setWinImageUrl(event.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-[#0f766e]"
              />
              <label className="mt-2 inline-flex cursor-pointer items-center rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-semibold text-[#334155]">
                {isUploadingWinImage ? "アップロード中..." : "画像をアップロード"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => void handleResultImageUpload(event, "win")}
                  className="hidden"
                  disabled={isUploadingWinImage || isSaving}
                />
              </label>
              {winImageUrl ? (
                <img src={winImageUrl} alt="当たり画像プレビュー" className="mt-2 h-24 rounded-lg border border-[#e2e8f0] object-cover" />
              ) : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-[#334155]">ハズレ画像URL（任意）</span>
              <input
                type="url"
                value={loseImageUrl}
                onChange={(event) => setLoseImageUrl(event.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-[#0f766e]"
              />
              <label className="mt-2 inline-flex cursor-pointer items-center rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-semibold text-[#334155]">
                {isUploadingLoseImage ? "アップロード中..." : "画像をアップロード"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => void handleResultImageUpload(event, "lose")}
                  className="hidden"
                  disabled={isUploadingLoseImage || isSaving}
                />
              </label>
              {loseImageUrl ? (
                <img src={loseImageUrl} alt="ハズレ画像プレビュー" className="mt-2 h-24 rounded-lg border border-[#e2e8f0] object-cover" />
              ) : null}
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-[#334155]">ランク別当選率 (%)</p>
            <p className="text-xs text-[#64748b]">
              未入力の場合は上の「当選確率」を使用します。
            </p>
            <div className="space-y-2">
              {ranks.map((rank) => (
                <label key={rank.id} className="grid grid-cols-[1fr_110px] items-center gap-3">
                  <span className="text-sm text-[#334155]">{rank.name}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={rankWinProbabilities[rank.id] ?? ""}
                    onChange={(event) =>
                      setRankWinProbabilities((prev) => ({
                        ...prev,
                        [rank.id]: event.target.value,
                      }))
                    }
                    placeholder="未設定"
                    className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-[#0f766e]"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex w-full items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#334155]">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              来店ガチャを有効化する
            </label>
            <button
              type="submit"
              disabled={!canSubmit || isSaving || isUploadingWinImage || isUploadingLoseImage || gifts.length === 0}
              className="ml-auto rounded-lg bg-[#0f766e] px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
            >
              {isSaving ? "保存中..." : "設定を保存"}
            </button>
          </div>
          {gifts.length === 0 ? (
            <p className="text-sm text-[#b91c1c]">先にギフトを作成してください。</p>
          ) : null}
        </form>

        {message ? (
          <p className={`mt-3 text-sm ${isError ? "text-[#b91c1c]" : "text-[#0f766e]"}`}>{message}</p>
        ) : null}
      </section>
    </div>
  );
}
