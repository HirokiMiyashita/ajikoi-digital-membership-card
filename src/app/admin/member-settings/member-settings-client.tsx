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

type EditableRank = {
  key: string;
  id?: string;
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
      <div
        role="img"
        aria-label={gift.title}
        className="h-14 w-20 rounded bg-[#f1f5f9] bg-cover bg-center"
        style={{ backgroundImage: `url("${gift.previewImageUrl.replaceAll('"', "%22")}")` }}
      />
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
  const [editingRankDefinitions, setEditingRankDefinitions] = useState(false);
  const [rankDefinitions, setRankDefinitions] = useState<EditableRank[]>(
    ranks.map((rank) => ({ key: rank.id, ...rank })),
  );
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

  const saveRankDefinitions = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/ranks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ranks: rankDefinitions.map(({ id, name, minPoints }) => ({
            ...(id ? { id } : {}),
            name,
            minPoints,
          })),
        }),
      });
      const json = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.message ?? "ランク設定の保存に失敗しました。");
      }
      window.location.reload();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "ランク設定の保存に失敗しました。");
      setIsSaving(false);
    }
  };

  const moveRank = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rankDefinitions.length) return;
    setRankDefinitions((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      const thresholds = current.map((rank) => rank.minPoints).sort((a, b) => a - b);
      return next.map((rank, rankIndex) => ({
        ...rank,
        minPoints: thresholds[rankIndex],
      }));
    });
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
          <div>
            <h2 className="font-semibold text-[#0f172a]">ランク設定</h2>
            <p className="mt-1 text-xs text-[#64748b]">
              ランクの追加・削除・並び順と到達ポイントを店舗ごとに設定します。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditingRankDefinitions((current) => !current)}
            className="rounded border border-[#cbd5e1] bg-white px-3 py-1 text-sm font-semibold text-[#334155]"
          >
            {editingRankDefinitions ? "キャンセル" : "編集"}
          </button>
        </div>
        <div className="divide-y divide-[#e2e8f0]">
          {rankDefinitions.map((rank, index) => (
            <div key={rank.key} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
              <label className="text-sm font-semibold text-[#334155]">
                ランク名
                <input
                  value={rank.name}
                  onChange={(event) =>
                    setRankDefinitions((current) =>
                      current.map((item) =>
                        item.key === rank.key ? { ...item, name: event.target.value } : item,
                      ),
                    )
                  }
                  disabled={!editingRankDefinitions}
                  maxLength={30}
                  className="mt-1 w-full rounded border border-[#cbd5e1] px-3 py-2 font-normal disabled:border-transparent disabled:bg-transparent disabled:px-0"
                />
              </label>
              <label className="text-sm font-semibold text-[#334155]">
                必要ポイント
                <input
                  type="number"
                  min="0"
                  value={rank.minPoints}
                  onChange={(event) =>
                    setRankDefinitions((current) =>
                      current.map((item) =>
                        item.key === rank.key
                          ? { ...item, minPoints: Number(event.target.value) }
                          : item,
                      ),
                    )
                  }
                  disabled={!editingRankDefinitions || index === 0}
                  className="mt-1 w-full rounded border border-[#cbd5e1] px-3 py-2 font-normal disabled:border-transparent disabled:bg-transparent disabled:px-0"
                />
              </label>
              {editingRankDefinitions ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveRank(index, -1)}
                    disabled={index === 0}
                    aria-label={`${rank.name}を上へ移動`}
                    className="rounded border border-[#cbd5e1] px-2 py-2 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveRank(index, 1)}
                    disabled={index === rankDefinitions.length - 1}
                    aria-label={`${rank.name}を下へ移動`}
                    className="rounded border border-[#cbd5e1] px-2 py-2 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setRankDefinitions((current) =>
                        current.filter((item) => item.key !== rank.key),
                      )
                    }
                    disabled={rankDefinitions.length === 1}
                    className="rounded border border-[#fecaca] px-2 py-2 text-[#dc2626] disabled:opacity-30"
                  >
                    削除
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {editingRankDefinitions ? (
          <div className="flex flex-wrap gap-2 border-t border-[#e2e8f0] px-4 py-3">
            <button
              type="button"
              onClick={() =>
                setRankDefinitions((current) => [
                  ...current,
                  {
                    key: `new-${Date.now()}`,
                    name: `ランク${current.length + 1}`,
                    minPoints: (current[current.length - 1]?.minPoints ?? 0) + 10,
                  },
                ])
              }
              disabled={rankDefinitions.length >= 10}
              className="rounded border border-[#0f766e] px-4 py-2 text-sm font-bold text-[#0f766e] disabled:opacity-40"
            >
              ランクを追加
            </button>
            <button
              type="button"
              onClick={() => void saveRankDefinitions()}
              disabled={isSaving}
              className="rounded bg-[#0f766e] px-4 py-2 text-sm font-bold text-white disabled:bg-[#94a3b8]"
            >
              {isSaving ? "保存中..." : "ランク設定を保存"}
            </button>
          </div>
        ) : null}
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
