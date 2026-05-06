"use client";

import { FormEvent, useMemo, useState } from "react";

type GiftOption = {
  id: string;
  title: string;
};

type InitialSetting = {
  giftId: string;
  winProbability: number;
  isActive: boolean;
} | null;

type Props = {
  gifts: GiftOption[];
  initialSetting: InitialSetting;
};

export default function VisitGachaClient({ gifts, initialSetting }: Props) {
  const [giftId, setGiftId] = useState(initialSetting?.giftId ?? "");
  const [winProbability, setWinProbability] = useState(String(initialSetting?.winProbability ?? 20));
  const [isActive, setIsActive] = useState(initialSetting?.isActive ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const loseProbability = useMemo(() => {
    const value = Number(winProbability);
    if (!Number.isFinite(value)) return null;
    return Math.max(0, 100 - value);
  }, [winProbability]);

  const canSubmit = useMemo(() => {
    const value = Number(winProbability);
    return giftId.length > 0 && Number.isInteger(value) && value >= 0 && value <= 100;
  }, [giftId, winProbability]);

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
          winProbability: Number(winProbability),
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
              disabled={!canSubmit || isSaving || gifts.length === 0}
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
