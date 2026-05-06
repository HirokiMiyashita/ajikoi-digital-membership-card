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
};

type MembersClientProps = {
  initialMembers: MemberRow[];
  officialAccounts: OfficialAccountOption[];
};

export default function MembersClient({ initialMembers, officialAccounts }: MembersClientProps) {
  const [members, setMembers] = useState(initialMembers);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [dialogUser, setDialogUser] = useState<MemberRow | null>(null);
  const [dialogRole, setDialogRole] = useState<"staff" | null>(null);
  const [dialogOfficialAccountId, setDialogOfficialAccountId] = useState<string>("");

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
        <p className="text-sm text-[#64748b]">全{members.length}件</p>
      </div>
      <section className="mx-auto w-[90%] overflow-hidden rounded-xl border border-[#dbe2ea] bg-white shadow-sm">
        <div className="grid grid-cols-[1fr_auto_auto_auto] border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm font-bold text-[#334155]">
          <p>会員名</p>
          <p className="px-2">ランク</p>
          <p className="px-2">来店数</p>
          <p className="px-2">スタッフ設定</p>
        </div>
        {members.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[#64748b]">会員データがありません。</p>
        ) : (
          members.map((row) => (
            <div
              key={row.userId}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center border-b border-[#f1f5f9] px-4 py-3 text-sm text-[#0f172a] last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate">{row.displayName}</p>
                <p className="truncate text-xs text-[#94a3b8]">{row.userId}</p>
              </div>
              <p className="px-2">{row.rankName}</p>
              <p className="px-2 text-right font-semibold">{row.checkInCount}回</p>
              <div className="flex gap-2 px-2">
                <button
                  type="button"
                  disabled={updatingUserId === row.userId}
                  onClick={() => openStaffDialog(row)}
                  className="rounded bg-[#0f766e] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {row.role === "staff" ? "スタッフ設定" : "スタッフにする"}
                </button>
                {row.role === "staff" ? (
                  <button
                    type="button"
                    disabled={updatingUserId === row.userId}
                    onClick={() => {
                      void handleRoleChange(row.userId, null, null);
                    }}
                    className="rounded border border-[#cbd5e1] bg-white px-3 py-1 text-xs font-semibold text-[#334155] disabled:opacity-50"
                  >
                    解除
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </section>
      {dialogUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <section className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg">
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
