"use client";

import { useState } from "react";

type MemberRow = {
  userId: string;
  displayName: string;
  role: "staff" | null;
  checkInCount: number;
  rankName: string;
};

type MembersClientProps = {
  initialMembers: MemberRow[];
};

export default function MembersClient({ initialMembers }: MembersClientProps) {
  const [members, setMembers] = useState(initialMembers);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, role: "staff" | null) => {
    setUpdatingUserId(userId);
    try {
      const response = await fetch(`/api/admin/members/${encodeURIComponent(userId)}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });
      const json = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.message ?? "ロール更新に失敗しました。");
      }
      setMembers((prev) =>
        prev.map((member) => (member.userId === userId ? { ...member, role } : member)),
      );
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
          <p className="px-2">ロール</p>
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
              <div className="px-2">
                <select
                  value={row.role ?? ""}
                  disabled={updatingUserId === row.userId}
                  onChange={(event) => {
                    const nextRole = event.target.value === "staff" ? "staff" : null;
                    void handleRoleChange(row.userId, nextRole);
                  }}
                  className="rounded border border-[#cbd5e1] bg-white px-2 py-1 text-sm disabled:opacity-50"
                >
                  <option value="">通常</option>
                  <option value="staff">staff</option>
                </select>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
