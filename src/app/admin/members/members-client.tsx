"use client";

import { useState } from "react";

type OfficialAccountOption = {
  id: string;
  label: string;
};

type MemberRow = {
  userId: string;
  displayName: string;
  role: "staff" | null;
  assignedOfficialAccountId: string | null;
  checkInCount: number;
  rankName: string;
  registeredAt: string;
  lastVisitedAt: string | null;
};

type MembersClientProps = {
  initialMembers: MemberRow[];
  officialAccounts: OfficialAccountOption[];
};

type MemberGiftOption = {
  id: string;
  title: string;
};

type MemberGiftRow = {
  userGiftId: string;
  giftId: string;
  title: string;
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
};

export default function MembersClient({ initialMembers, officialAccounts }: MembersClientProps) {
  const [members, setMembers] = useState(initialMembers);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogUser, setDialogUser] = useState<MemberRow | null>(null);
  const [detailUser, setDetailUser] = useState<MemberRow | null>(null);
  const [availableGifts, setAvailableGifts] = useState<MemberGiftOption[]>([]);
  const [unusedGifts, setUnusedGifts] = useState<MemberGiftRow[]>([]);
  const [usedGifts, setUsedGifts] = useState<MemberGiftRow[]>([]);
  const [selectedGiftId, setSelectedGiftId] = useState("");
  const [isGiftLoading, setIsGiftLoading] = useState(false);
  const [isGiftMutating, setIsGiftMutating] = useState(false);
  const [giftError, setGiftError] = useState<string | null>(null);
  const [dialogRole, setDialogRole] = useState<"staff" | null>(null);
  const [dialogOfficialAccountId, setDialogOfficialAccountId] = useState<string>("");

  const formatDateTime = (value: string | null) => {
    if (!value) {
      return "未記録";
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const resolveOfficialAccountLabel = (officialAccountId: string | null) => {
    if (!officialAccountId) {
      return "未設定";
    }
    return officialAccounts.find((account) => account.id === officialAccountId)?.label ?? officialAccountId;
  };

  const fetchMemberGifts = async (userId: string) => {
    setIsGiftLoading(true);
    setGiftError(null);
    try {
      const response = await fetch(`/api/admin/members/${encodeURIComponent(userId)}/gifts`);
      const json = (await response.json()) as {
        ok?: boolean;
        message?: string;
        availableGifts?: MemberGiftOption[];
        unusedGifts?: MemberGiftRow[];
        usedGifts?: MemberGiftRow[];
      };
      if (!response.ok || !json.ok) {
        throw new Error(json.message ?? "ギフト情報の取得に失敗しました。");
      }
      const nextAvailableGifts = json.availableGifts ?? [];
      setAvailableGifts(nextAvailableGifts);
      setUnusedGifts(json.unusedGifts ?? []);
      setUsedGifts(json.usedGifts ?? []);
      setSelectedGiftId((prev) => {
        if (prev && nextAvailableGifts.some((gift) => gift.id === prev)) {
          return prev;
        }
        return nextAvailableGifts[0]?.id ?? "";
      });
    } catch (error) {
      setGiftError(error instanceof Error ? error.message : "ギフト情報の取得に失敗しました。");
      setAvailableGifts([]);
      setUnusedGifts([]);
      setUsedGifts([]);
      setSelectedGiftId("");
    } finally {
      setIsGiftLoading(false);
    }
  };

  const openDetailModal = (member: MemberRow) => {
    setDetailUser(member);
    void fetchMemberGifts(member.userId);
  };

  const closeDetailModal = () => {
    setDetailUser(null);
    setGiftError(null);
  };

  const handleIssueGift = async () => {
    if (!detailUser || !selectedGiftId || isGiftMutating) return;
    setIsGiftMutating(true);
    setGiftError(null);
    try {
      const response = await fetch(`/api/admin/members/${encodeURIComponent(detailUser.userId)}/gifts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ giftId: selectedGiftId }),
      });
      const json = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.message ?? "ギフト付与に失敗しました。");
      }
      await fetchMemberGifts(detailUser.userId);
    } catch (error) {
      setGiftError(error instanceof Error ? error.message : "ギフト付与に失敗しました。");
    } finally {
      setIsGiftMutating(false);
    }
  };

  const handleMarkGiftUsed = async (userGiftId: string) => {
    if (!detailUser || isGiftMutating) return;
    if (!window.confirm("このギフトを使用済みにしますか？")) return;
    setIsGiftMutating(true);
    setGiftError(null);
    try {
      const response = await fetch(
        `/api/admin/members/${encodeURIComponent(detailUser.userId)}/gifts/${encodeURIComponent(userGiftId)}`,
        { method: "PATCH" },
      );
      const json = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.message ?? "使用済み更新に失敗しました。");
      }
      await fetchMemberGifts(detailUser.userId);
    } catch (error) {
      setGiftError(error instanceof Error ? error.message : "使用済み更新に失敗しました。");
    } finally {
      setIsGiftMutating(false);
    }
  };

  const openStaffDialog = (member: MemberRow) => {
    setDialogUser(member);
    setDialogRole(member.role);
    setDialogOfficialAccountId(
      member.assignedOfficialAccountId ?? officialAccounts[0]?.id ?? "",
    );
  };

  const closeDialog = () => {
    setDialogUser(null);
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredMembers =
    normalizedQuery.length === 0
      ? members
      : members.filter((member) => {
          return (
            member.displayName.toLowerCase().includes(normalizedQuery) ||
            member.userId.toLowerCase().includes(normalizedQuery) ||
            member.rankName.toLowerCase().includes(normalizedQuery)
          );
        });

  const handleRoleChange = async (
    userId: string,
    role: "staff" | null,
    officialAccountId: string | null,
  ) => {
    setUpdatingUserId(userId);
    try {
      const response = await fetch(`/api/admin/members/${encodeURIComponent(userId)}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role,
          officialAccountId,
        }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        message?: string;
        role?: "staff" | null;
        officialAccountId?: string | null;
      };
      if (!response.ok || !json.ok) {
        throw new Error(json.message ?? "ロール更新に失敗しました。");
      }
      setMembers((prev) =>
        prev.map((member) =>
          member.userId === userId
            ? {
                ...member,
                role: json.role ?? role,
                assignedOfficialAccountId: json.officialAccountId ?? null,
              }
            : member,
        ),
      );
      closeDialog();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "ロール更新に失敗しました。");
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="mx-auto flex w-[90%] items-end justify-between">
        <h1 className="text-xl font-bold">会員情報</h1>
        <p className="text-sm text-[#64748b]">全{filteredMembers.length}件</p>
      </div>
      <div className="mx-auto w-[90%]">
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="会員名 / userId / ランクで検索"
          className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] shadow-sm outline-none focus:border-[#0f766e]"
        />
      </div>
      <section className="mx-auto w-[90%] overflow-hidden rounded-xl border border-[#dbe2ea] bg-white shadow-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_68px_56px_96px_44px] border-b border-[#e2e8f0] bg-[#f8fafc] px-3 py-3 text-xs font-bold text-[#334155] sm:px-4 sm:text-sm">
          <p>会員名</p>
          <p className="px-1 text-center sm:px-2">ランク</p>
          <p className="px-1 text-center sm:px-2">来店</p>
          <p className="px-1 text-center sm:px-2">設定</p>
          <p className="px-1 text-center sm:px-2">詳細</p>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {filteredMembers.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[#64748b]">
              {searchQuery.trim().length > 0 ? "一致する会員が見つかりません。" : "会員データがありません。"}
            </p>
          ) : (
            filteredMembers.map((row) => (
              <div
                key={row.userId}
                className="grid grid-cols-[minmax(0,1fr)_68px_56px_96px_44px] items-center border-b border-[#f1f5f9] px-3 py-3 text-sm text-[#0f172a] last:border-b-0 sm:px-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.displayName}</p>
                  <p className="hidden truncate text-xs text-[#94a3b8] sm:block">{row.userId}</p>
                </div>
                <p className="truncate px-1 text-center text-xs sm:px-2 sm:text-sm">{row.rankName}</p>
                <p className="px-1 text-center text-sm font-semibold sm:px-2">{row.checkInCount}回</p>
                <div className="flex justify-center gap-1 px-1 sm:gap-2 sm:px-2">
                  <button
                    type="button"
                    disabled={updatingUserId === row.userId}
                    onClick={() => openStaffDialog(row)}
                    className="rounded bg-[#0f766e] px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50 sm:px-3 sm:text-xs"
                  >
                    <span className="sm:hidden">設定</span>
                    <span className="hidden sm:inline">{row.role === "staff" ? "スタッフ設定" : "スタッフにする"}</span>
                  </button>
                  {row.role === "staff" ? (
                    <button
                      type="button"
                      disabled={updatingUserId === row.userId}
                      onClick={() => {
                        void handleRoleChange(row.userId, null, null);
                      }}
                      className="rounded border border-[#cbd5e1] bg-white px-2 py-1 text-[11px] font-semibold text-[#334155] disabled:opacity-50 sm:px-3 sm:text-xs"
                    >
                      <span className="sm:hidden">解</span>
                      <span className="hidden sm:inline">解除</span>
                    </button>
                  ) : null}
                </div>
                <div className="flex justify-center px-1 sm:px-2">
                  <button
                    type="button"
                    onClick={() => openDetailModal(row)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#cbd5e1] bg-white text-[#334155] hover:bg-[#f8fafc]"
                    aria-label={`${row.displayName}の詳細を表示`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      {detailUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-4">
          <section className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-lg">
            <h2 className="text-base font-bold text-[#0f172a]">会員詳細</h2>
            <p className="mt-1 text-sm text-[#64748b]">{detailUser.displayName}</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3 border-b border-[#f1f5f9] pb-2">
                <dt className="text-[#64748b]">userId</dt>
                <dd className="break-all text-right font-semibold text-[#0f172a]">{detailUser.userId}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-[#f1f5f9] pb-2">
                <dt className="text-[#64748b]">ロール</dt>
                <dd className="font-semibold text-[#0f172a]">{detailUser.role ?? "通常"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-[#f1f5f9] pb-2">
                <dt className="text-[#64748b]">ランク</dt>
                <dd className="font-semibold text-[#0f172a]">{detailUser.rankName}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-[#f1f5f9] pb-2">
                <dt className="text-[#64748b]">来店回数</dt>
                <dd className="font-semibold text-[#0f172a]">{detailUser.checkInCount}回</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-[#f1f5f9] pb-2">
                <dt className="text-[#64748b]">登録日時</dt>
                <dd className="font-semibold text-[#0f172a]">{formatDateTime(detailUser.registeredAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-[#f1f5f9] pb-2">
                <dt className="text-[#64748b]">最終来店日時</dt>
                <dd className="font-semibold text-[#0f172a]">{formatDateTime(detailUser.lastVisitedAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#64748b]">担当公式アカウント</dt>
                <dd className="text-right font-semibold text-[#0f172a]">
                  {resolveOfficialAccountLabel(detailUser.assignedOfficialAccountId)}
                </dd>
              </div>
            </dl>
            <div className="mt-5 border-t border-[#e2e8f0] pt-4">
              <h3 className="text-sm font-bold text-[#0f172a]">ギフト管理</h3>
              <div className="mt-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
                <p className="text-xs font-semibold text-[#475569]">ギフトを追加</p>
                <div className="mt-2 flex gap-2">
                  <select
                    value={selectedGiftId}
                    onChange={(event) => setSelectedGiftId(event.target.value)}
                    disabled={isGiftLoading || isGiftMutating || availableGifts.length === 0}
                    className="min-w-0 flex-1 rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm"
                  >
                    {availableGifts.length === 0 ? (
                      <option value="">登録済みギフトがありません</option>
                    ) : (
                      availableGifts.map((gift) => (
                        <option key={gift.id} value={gift.id}>
                          {gift.title}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleIssueGift()}
                    disabled={isGiftLoading || isGiftMutating || !selectedGiftId}
                    className="rounded bg-[#0f766e] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    付与
                  </button>
                </div>
              </div>
              {giftError ? (
                <p className="mt-2 text-xs font-semibold text-[#b91c1c]">{giftError}</p>
              ) : null}
              <div className="mt-4">
                <p className="text-xs font-bold text-[#0f172a]">未使用ギフト（{unusedGifts.length}件）</p>
                {isGiftLoading ? (
                  <p className="mt-2 text-xs text-[#64748b]">読み込み中...</p>
                ) : unusedGifts.length === 0 ? (
                  <p className="mt-2 text-xs text-[#94a3b8]">未使用ギフトはありません。</p>
                ) : (
                  <div className="mt-2 max-h-44 space-y-2 overflow-y-auto">
                    {unusedGifts.map((gift) => (
                      <div key={gift.userGiftId} className="rounded border border-[#e2e8f0] bg-white px-3 py-2">
                        <p className="text-sm font-semibold text-[#0f172a]">{gift.title}</p>
                        <p className="mt-1 text-xs text-[#64748b]">
                          付与: {formatDateTime(gift.issuedAt)} / 期限: {formatDateTime(gift.expiresAt)}
                        </p>
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => void handleMarkGiftUsed(gift.userGiftId)}
                            disabled={isGiftMutating}
                            className="rounded border border-[#86efac] px-2 py-1 text-xs font-semibold text-[#166534] disabled:opacity-50"
                          >
                            使用済みにする
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-4">
                <p className="text-xs font-bold text-[#0f172a]">使用済みギフト（{usedGifts.length}件）</p>
                {isGiftLoading ? null : usedGifts.length === 0 ? (
                  <p className="mt-2 text-xs text-[#94a3b8]">使用済みギフトはありません。</p>
                ) : (
                  <div className="mt-2 max-h-44 space-y-2 overflow-y-auto">
                    {usedGifts.map((gift) => (
                      <div key={gift.userGiftId} className="rounded border border-[#e2e8f0] bg-white px-3 py-2">
                        <p className="text-sm font-semibold text-[#0f172a]">{gift.title}</p>
                        <p className="mt-1 text-xs text-[#64748b]">
                          使用: {formatDateTime(gift.usedAt)} / 期限: {formatDateTime(gift.expiresAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={closeDetailModal}
                className="rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#334155]"
              >
                閉じる
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {dialogUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-4">
          <section className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 shadow-lg">
            <h2 className="text-base font-bold text-[#0f172a]">スタッフ設定</h2>
            <p className="mt-1 text-sm text-[#64748b]">{dialogUser.displayName}</p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-[#334155]">ロール</span>
                <select
                  value={dialogRole ?? ""}
                  onChange={(event) =>
                    setDialogRole(event.target.value === "staff" ? "staff" : null)
                  }
                  className="w-full rounded border border-[#cbd5e1] px-3 py-2"
                >
                  <option value="">通常</option>
                  <option value="staff">staff</option>
                </select>
              </label>
              {dialogRole === "staff" ? (
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold text-[#334155]">担当公式アカウント</span>
                  <select
                    value={dialogOfficialAccountId}
                    onChange={(event) => setDialogOfficialAccountId(event.target.value)}
                    className="w-full rounded border border-[#cbd5e1] px-3 py-2"
                  >
                    {officialAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDialog}
                className="rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#334155]"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={
                  updatingUserId === dialogUser.userId ||
                  (dialogRole === "staff" && !dialogOfficialAccountId)
                }
                onClick={() => {
                  const accountId = dialogRole === "staff" ? dialogOfficialAccountId : null;
                  void handleRoleChange(dialogUser.userId, dialogRole, accountId);
                }}
                className="rounded bg-[#0f766e] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
