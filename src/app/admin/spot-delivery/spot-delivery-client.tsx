"use client";

import { FormEvent, useMemo, useState } from "react";

type UserOption = {
  userId: string;
  displayName: string;
};

type Props = {
  users: UserOption[];
};

export default function SpotDeliveryClient({ users }: Props) {
  const [message, setMessage] = useState("");
  const [targetMode, setTargetMode] = useState<"all" | "selected">("all");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const canSubmit = useMemo(() => {
    if (!message.trim()) return false;
    if (targetMode === "selected") return selectedUserIds.length > 0;
    return true;
  }, [message, targetMode, selectedUserIds]);

  const toggleSelectedUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setResultMessage(null);
    setIsError(false);

    try {
      const response = await fetch("/api/admin/spot-delivery/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          targetMode,
          userIds: targetMode === "selected" ? selectedUserIds : [],
        }),
      });
      const json = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !json.ok) {
        setIsError(true);
        setResultMessage(json.message ?? "配信リクエストに失敗しました。");
        return;
      }

      setResultMessage("配信ジョブを開始しました。Inngestで実行状況を確認できます。");
      setMessage("");
      setSelectedUserIds([]);
    } catch {
      setIsError(true);
      setResultMessage("通信エラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-4 p-4">
      <h1 className="mx-auto w-[90%] text-xl font-bold">スポット配信（トリガー配信）</h1>
      <section className="mx-auto w-[90%] rounded-xl border border-[#dbe2ea] bg-white p-4 shadow-sm">
        <h2 className="font-bold">新規トリガー配信</h2>
        <p className="mt-1 text-sm text-[#64748b]">
          メッセージを入力して即時配信を開始します（Inngest経由）。
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#334155]">配信メッセージ</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="min-h-[120px] w-full rounded-lg border border-[#cbd5e1] px-3 py-2 outline-none focus:border-[#0f766e]"
              placeholder="配信するテキストを入力してください"
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-[#334155]">配信対象</legend>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="targetMode"
                checked={targetMode === "all"}
                onChange={() => setTargetMode("all")}
              />
              すべての会員
            </label>
            <label className="ml-4 inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="targetMode"
                checked={targetMode === "selected"}
                onChange={() => setTargetMode("selected")}
              />
              対象会員を選択
            </label>
          </fieldset>

          {targetMode === "selected" ? (
            <div className="rounded-lg border border-[#dbe2ea] p-3">
              <p className="mb-2 text-sm font-semibold text-[#334155]">対象会員（最大300件）</p>
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {users.map((user) => (
                  <label key={user.userId} className="flex items-center gap-2 text-sm text-[#334155]">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(user.userId)}
                      onChange={() => toggleSelectedUser(user.userId)}
                    />
                    <span className="truncate">
                      {user.displayName} ({user.userId})
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="rounded-lg bg-[#0f766e] px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
          >
            {isSubmitting ? "送信ジョブ作成中..." : "配信を開始"}
          </button>
        </form>

        {resultMessage ? (
          <p className={`mt-3 text-sm ${isError ? "text-[#b91c1c]" : "text-[#0f766e]"}`}>{resultMessage}</p>
        ) : null}
      </section>
    </div>
  );
}
