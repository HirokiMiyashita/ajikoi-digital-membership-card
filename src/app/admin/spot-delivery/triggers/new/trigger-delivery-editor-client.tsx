"use client";

import Link from "next/link";
import { useState } from "react";

type TriggerType = "USER_SIGNUP" | "CHECKIN_POINT_GRANTED" | "RANK_UP";

type Props = {
  mode?: "create" | "edit";
  triggerId?: string;
  initialValue?: {
    title: string;
    triggerType: TriggerType;
    message: string;
    isActive: boolean;
  };
};

export default function TriggerDeliveryEditorClient({
  mode = "create",
  triggerId,
  initialValue,
}: Props) {
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [triggerType, setTriggerType] = useState<TriggerType>(initialValue?.triggerType ?? "USER_SIGNUP");
  const [message, setMessage] = useState(initialValue?.message ?? "");
  const [isActive, setIsActive] = useState(initialValue?.isActive ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const canSubmit = title.trim().length > 0 && message.trim().length > 0 && !isSaving;

  const showToast = (text: string, error = false) => {
    setToast(text);
    setIsError(error);
    setTimeout(() => setToast(null), 2400);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSaving(true);
    try {
      const endpoint =
        mode === "edit" && triggerId
          ? `/api/admin/spot-delivery/triggers/${encodeURIComponent(triggerId)}`
          : "/api/admin/spot-delivery/triggers";
      const response = await fetch(endpoint, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          triggerType,
          message: message.trim(),
          isActive,
        }),
      });
      const json = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.message ?? "トリガー配信の保存に失敗しました。");
      }
      showToast(mode === "edit" ? "トリガー配信を更新しました。" : "トリガー配信を保存しました。");
      setTimeout(() => {
        window.location.href = "/admin/spot-delivery";
      }, 700);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "トリガー配信の保存に失敗しました。", true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full space-y-4 p-4">
      <div className="mx-auto flex w-[90%] items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/spot-delivery" className="text-xl leading-none text-[#334155]">
            ←
          </Link>
          <h1 className="text-xl font-bold">
            {mode === "edit" ? "トリガー配信を編集" : "トリガー配信を作成"}
          </h1>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="mx-auto w-[90%] space-y-4 rounded-xl border border-[#dbe2ea] bg-white p-4 shadow-sm">
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-[#334155]">タイトル</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例: 会員登録ありがとう配信"
            className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-[#0f9f99]"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-[#334155]">トリガー条件</span>
          <select
            value={triggerType}
            onChange={(event) => setTriggerType(event.target.value as TriggerType)}
            className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-[#0f9f99]"
          >
            <option value="USER_SIGNUP">会員登録時</option>
            <option value="CHECKIN_POINT_GRANTED">来店ポイント付与時</option>
            <option value="RANK_UP">ランクアップ時</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-[#334155]">本文</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="配信するメッセージ本文"
            rows={5}
            className="w-full resize-y rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-[#0f9f99]"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-[#334155]">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            className="h-4 w-4 rounded border-[#cbd5e1]"
          />
          このトリガー配信を有効にする
        </label>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-[#0f9f99] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
          >
            {isSaving ? "保存中..." : mode === "edit" ? "更新" : "保存"}
          </button>
        </div>
      </form>
      {toast ? (
        <div
          className={`fixed inset-x-0 bottom-20 z-50 mx-auto w-fit rounded-full px-4 py-2 text-sm font-semibold text-white ${
            isError ? "bg-[#b91c1c]" : "bg-[#111827]"
          }`}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
