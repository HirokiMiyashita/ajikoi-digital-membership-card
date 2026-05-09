"use client";

import { useMemo, useState } from "react";

type Props = {
  hasPassword: boolean;
  updatedAtIso: string | null;
};

export default function ReviewPasswordClient({ hasPassword, updatedAtIso }: Props) {
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [passwordExists, setPasswordExists] = useState(hasPassword);
  const [updatedAt, setUpdatedAt] = useState<string | null>(updatedAtIso);

  const updatedLabel = useMemo(() => {
    if (!updatedAt) return "未設定";
    const date = new Date(updatedAt);
    if (Number.isNaN(date.getTime())) return "未設定";
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(
      date.getDate(),
    ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }, [updatedAt]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const handleSave = async () => {
    if (!/^\d{4}$/.test(password)) {
      showToast("4桁の数字で入力してください。");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/review-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = (await response.json()) as { ok?: boolean; message?: string; updatedAt?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.message ?? "口コミパスワードの保存に失敗しました。");
      }
      setPasswordExists(true);
      setUpdatedAt(json.updatedAt ?? new Date().toISOString());
      setPassword("");
      showToast("口コミパスワードを保存しました。");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "口コミパスワードの保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="mx-auto w-[90%] text-xl font-bold">口コミパスワード</h1>
      <section className="mx-auto w-[90%] rounded-xl border border-[#dbe2ea] bg-white px-4 py-4 shadow-sm">
        <p className="text-sm font-semibold text-[#0f172a]">4桁の確認用パスワード</p>
        <p className="mt-2 text-sm text-[#475569]">
          ユーザー側の「完了」後に入力する4桁数字を設定します。
        </p>
        <p className="mt-2 text-xs text-[#64748b]">
          現在の状態: {passwordExists ? "設定済み" : "未設定"} / 更新日時: {updatedLabel}
        </p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          pattern="[0-9]*"
          value={password}
          onChange={(event) => setPassword(event.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="4桁の数字"
          className="mt-4 w-full rounded-lg border border-[#cbd5e1] px-3 py-3 text-base tracking-[0.3em] text-[#0f172a] outline-none focus:border-[#14b8a6]"
        />
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="mt-4 w-full rounded-lg bg-[#0f766e] py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
        >
          {isSaving ? "保存中..." : "保存"}
        </button>
      </section>
      {toast ? (
        <div className="fixed inset-x-0 bottom-24 z-50 mx-auto w-fit rounded-full bg-[#111827] px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
