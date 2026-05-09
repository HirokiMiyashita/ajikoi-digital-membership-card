"use client";

import { useMemo, useState } from "react";

type GiftOption = {
  id: string;
  title: string;
  previewImageUrl: string;
};

type RankOption = {
  id: string;
  name: string;
  minPoints: number;
};

type Props = {
  gifts: GiftOption[];
  ranks: RankOption[];
  initialSignupGiftId: string | null;
  initialReviewGiftId: string | null;
  initialTopRankLoopGiftId: string | null;
  initialRankGiftMap: Record<string, string>;
};

type SavePayload = {
  signupGiftId?: string | null;
  reviewGiftId?: string | null;
  topRankLoopGiftId?: string | null;
  rankGiftSettings?: Array<{ rankId: string; giftId: string | null }>;
};

function GiftPreview({
  giftId,
  gifts,
  emptyLabel,
}: {
  giftId: string | null;
  gifts: GiftOption[];
  emptyLabel: string;
}) {
  if (!giftId) {
    return <p className="text-sm text-[#64748b]">{emptyLabel}</p>;
  }
  const gift = gifts.find((row) => row.id === giftId);
  if (!gift) {
    return <p className="text-sm text-[#64748b]">ギフト未設定</p>;
  }
  return (
    <div className="flex items-center gap-3 rounded border border-[#e2e8f0] bg-white p-3">
      <img src={gift.previewImageUrl} alt={gift.title} className="h-14 w-20 rounded object-cover" />
      <p className="text-sm font-semibold text-[#0f172a]">{gift.title}</p>
    </div>
  );
}

export default function MemberSettingsClient({
  gifts,
  ranks,
  initialSignupGiftId,
  initialReviewGiftId,
  initialTopRankLoopGiftId,
  initialRankGiftMap,
}: Props) {
  const [signupGiftId, setSignupGiftId] = useState<string | null>(initialSignupGiftId);
  const [reviewGiftId, setReviewGiftId] = useState<string | null>(initialReviewGiftId);
  const [topRankLoopGiftId, setTopRankLoopGiftId] = useState<string | null>(initialTopRankLoopGiftId);
  const [rankGiftMap, setRankGiftMap] = useState<Record<string, string>>(initialRankGiftMap);
  const [editingSignup, setEditingSignup] = useState(false);
  const [editingReview, setEditingReview] = useState(false);
  const [editingTopRankLoop, setEditingTopRankLoop] = useState(false);
  const [editingRanks, setEditingRanks] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const topRank = useMemo(() => {
    if (ranks.length === 0) {
      return null;
    }
    return ranks[ranks.length - 1];
  }, [ranks]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const saveSettings = async (payload: SavePayload) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/member-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.message ?? "会員設定の保存に失敗しました。");
      }
      showToast("会員設定を保存しました。");
      setEditingSignup(false);
      setEditingReview(false);
      setEditingTopRankLoop(false);
      setEditingRanks(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "会員設定の保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="mx-auto w-[90%] text-xl font-bold">会員設定</h1>

      <section className="mx-auto w-[90%] rounded-xl border border-[#dbe2ea] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
          <h2 className="font-semibold text-[#0f172a]">会員登録の特典</h2>
          <button
            type="button"
            onClick={() => setEditingSignup((prev) => !prev)}
            className="rounded border border-[#cbd5e1] bg-white px-3 py-1 text-sm font-semibold text-[#334155]"
          >
            編集
          </button>
        </div>
        <div className="space-y-3 px-4 py-3">
          {editingSignup ? (
            <>
              <select
                value={signupGiftId ?? ""}
                onChange={(event) => setSignupGiftId(event.target.value || null)}
                className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm"
              >
                <option value="">未設定</option>
                {gifts.map((gift) => (
                  <option key={gift.id} value={gift.id}>
                    {gift.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void saveSettings({ signupGiftId })}
                className="rounded bg-[#0f766e] px-4 py-2 text-sm font-bold text-white disabled:bg-[#94a3b8]"
              >
                保存
              </button>
            </>
          ) : (
            <GiftPreview giftId={signupGiftId} gifts={gifts} emptyLabel="無効" />
          )}
        </div>
      </section>

      <section className="mx-auto w-[90%] rounded-xl border border-[#dbe2ea] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
          <h2 className="font-semibold text-[#0f172a]">口コミ投稿の特典</h2>
          <button
            type="button"
            onClick={() => setEditingReview((prev) => !prev)}
            className="rounded border border-[#cbd5e1] bg-white px-3 py-1 text-sm font-semibold text-[#334155]"
          >
            編集
          </button>
        </div>
        <div className="space-y-3 px-4 py-3">
          <p className="text-sm text-[#334155]">Google口コミ投稿後に付与するギフト</p>
          {editingReview ? (
            <>
              <select
                value={reviewGiftId ?? ""}
                onChange={(event) => setReviewGiftId(event.target.value || null)}
                className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm"
              >
                <option value="">未設定</option>
                {gifts.map((gift) => (
                  <option key={gift.id} value={gift.id}>
                    {gift.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void saveSettings({ reviewGiftId })}
                className="rounded bg-[#0f766e] px-4 py-2 text-sm font-bold text-white disabled:bg-[#94a3b8]"
              >
                保存
              </button>
            </>
          ) : (
            <GiftPreview giftId={reviewGiftId} gifts={gifts} emptyLabel="無効" />
          )}
        </div>
      </section>

      <section className="mx-auto w-[90%] rounded-xl border border-[#dbe2ea] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
          <h2 className="font-semibold text-[#0f172a]">最高ランク者限定の周回特典</h2>
          <button
            type="button"
            onClick={() => setEditingTopRankLoop((prev) => !prev)}
            className="rounded border border-[#cbd5e1] bg-white px-3 py-1 text-sm font-semibold text-[#334155]"
          >
            編集
          </button>
        </div>
        <div className="space-y-3 px-4 py-3">
          <p className="text-sm text-[#334155]">{topRank ? `${topRank.name} 到達後の周回報酬` : "ランク未設定"}</p>
          {editingTopRankLoop ? (
            <>
              <select
                value={topRankLoopGiftId ?? ""}
                onChange={(event) => setTopRankLoopGiftId(event.target.value || null)}
                className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm"
              >
                <option value="">未設定</option>
                {gifts.map((gift) => (
                  <option key={gift.id} value={gift.id}>
                    {gift.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void saveSettings({ topRankLoopGiftId })}
                className="rounded bg-[#0f766e] px-4 py-2 text-sm font-bold text-white disabled:bg-[#94a3b8]"
              >
                保存
              </button>
            </>
          ) : (
            <GiftPreview giftId={topRankLoopGiftId} gifts={gifts} emptyLabel="無効" />
          )}
        </div>
      </section>

      <section className="mx-auto w-[90%] rounded-xl border border-[#dbe2ea] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
          <h2 className="font-semibold text-[#0f172a]">会員ランク特典</h2>
          <button
            type="button"
            onClick={() => setEditingRanks((prev) => !prev)}
            className="rounded border border-[#cbd5e1] bg-white px-3 py-1 text-sm font-semibold text-[#334155]"
          >
            編集
          </button>
        </div>
        <div className="divide-y divide-[#e2e8f0]">
          {ranks.map((rank) => {
            const rankGiftId = rankGiftMap[rank.id] ?? null;
            return (
              <div key={rank.id} className="space-y-2 px-4 py-3">
                <p className="font-semibold text-[#0f172a]">{rank.name}</p>
                <p className="text-sm text-[#64748b]">必要ポイント {rank.minPoints}</p>
                {editingRanks ? (
                  <select
                    value={rankGiftId ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setRankGiftMap((prev) => {
                        const next = { ...prev };
                        if (!value) {
                          delete next[rank.id];
                        } else {
                          next[rank.id] = value;
                        }
                        return next;
                      });
                    }}
                    className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm"
                  >
                    <option value="">未設定</option>
                    {gifts.map((gift) => (
                      <option key={gift.id} value={gift.id}>
                        {gift.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <GiftPreview giftId={rankGiftId} gifts={gifts} emptyLabel="無効" />
                )}
              </div>
            );
          })}
        </div>
        {editingRanks ? (
          <div className="border-t border-[#e2e8f0] px-4 py-3">
            <button
              type="button"
              disabled={isSaving}
              onClick={() =>
                void saveSettings({
                  rankGiftSettings: ranks.map((rank) => ({
                    rankId: rank.id,
                    giftId: rankGiftMap[rank.id] ?? null,
                  })),
                })
              }
              className="rounded bg-[#0f766e] px-4 py-2 text-sm font-bold text-white disabled:bg-[#94a3b8]"
            >
              保存
            </button>
          </div>
        ) : null}
      </section>

      {toast ? (
        <div className="fixed inset-x-0 bottom-20 z-50 mx-auto w-fit rounded-full bg-[#111827] px-4 py-2 text-sm font-semibold text-white">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
