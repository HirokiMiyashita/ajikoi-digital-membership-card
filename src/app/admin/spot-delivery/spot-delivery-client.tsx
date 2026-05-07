"use client";

import Link from "next/link";
import { useState } from "react";

type DeliveryHistory = {
  id: string;
  title: string;
  sentAt: string;
  sent: number;
  failed: number;
};
type TriggerSetting = {
  id: string;
  title: string;
  triggerType: "USER_SIGNUP" | "CHECKIN_POINT_GRANTED" | "RANK_UP";
  message: string;
  isActive: boolean;
  updatedAt: string;
};

type Props = {
  deliveryHistory: DeliveryHistory[];
  triggerSettings: TriggerSetting[];
};

function formatDeliveryDate(iso: string) {
  const date = new Date(iso);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

function resolveStatus(sent: number, failed: number) {
  if (sent === 0 && failed > 0) {
    return { label: "配信失敗", color: "bg-[#fee2e2] text-[#b91c1c]" };
  }
  if (sent > 0 && failed > 0) {
    return { label: "一部失敗", color: "bg-[#fef3c7] text-[#b45309]" };
  }
  return { label: "配信済", color: "bg-[#ccfbf1] text-[#0f766e]" };
}

function formatTriggerType(triggerType: TriggerSetting["triggerType"]) {
  if (triggerType === "USER_SIGNUP") return "会員登録時";
  if (triggerType === "CHECKIN_POINT_GRANTED") return "来店ポイント付与時";
  return "ランクアップ時";
}

export default function SpotDeliveryClient({ deliveryHistory, triggerSettings }: Props) {
  const [activeTab, setActiveTab] = useState<"spot" | "trigger">("spot");
  const [triggerRows, setTriggerRows] = useState(triggerSettings);
  const [updatingTriggerId, setUpdatingTriggerId] = useState<string | null>(null);

  const toggleTriggerActive = async (row: TriggerSetting) => {
    setUpdatingTriggerId(row.id);
    try {
      const response = await fetch(`/api/admin/spot-delivery/triggers/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: row.title,
          triggerType: row.triggerType,
          message: row.message ?? "",
          isActive: !row.isActive,
        }),
      });
      const json = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.message ?? "有効状態の切り替えに失敗しました。");
      }
      setTriggerRows((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? { ...item, isActive: !item.isActive, updatedAt: new Date().toISOString() }
            : item,
        ),
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "有効状態の切り替えに失敗しました。");
    } finally {
      setUpdatingTriggerId(null);
    }
  };

  const deleteTrigger = async (row: TriggerSetting) => {
    if (!window.confirm(`「${row.title}」を削除しますか？`)) {
      return;
    }
    setUpdatingTriggerId(row.id);
    try {
      const response = await fetch(`/api/admin/spot-delivery/triggers/${encodeURIComponent(row.id)}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.message ?? "削除に失敗しました。");
      }
      setTriggerRows((prev) => prev.filter((item) => item.id !== row.id));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "削除に失敗しました。");
    } finally {
      setUpdatingTriggerId(null);
    }
  };

  return (
    <div className="w-full space-y-4 p-4">
      <h1 className="mx-auto w-[90%] text-xl font-bold">LINE配信</h1>
      <section className="mx-auto w-[90%] rounded-xl border border-[#dbe2ea] bg-white shadow-sm">
        <div className="border-b border-[#e2e8f0] px-4 pt-3">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setActiveTab("spot")}
              className={`border-b-2 px-1 pb-2 text-sm font-semibold ${
                activeTab === "spot"
                  ? "border-[#0f766e] text-[#0f172a]"
                  : "border-transparent text-[#94a3b8]"
              }`}
            >
              スポット
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("trigger")}
              className={`border-b-2 px-1 pb-2 text-sm font-semibold ${
                activeTab === "trigger"
                  ? "border-[#0f766e] text-[#0f172a]"
                  : "border-transparent text-[#94a3b8]"
              }`}
            >
              トリガー
            </button>
          </div>
        </div>

        {activeTab === "spot" ? (
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <Link
                href="/admin/spot-delivery/new"
                className="rounded-lg bg-[#0f9f99] px-4 py-2 text-sm font-bold text-white"
              >
                + スポット配信を作成する
              </Link>
              <p className="text-sm text-[#64748b]">配信履歴 {deliveryHistory.length}件</p>
            </div>

            <div className="overflow-hidden rounded-lg border border-[#e2e8f0]">
              {deliveryHistory.length === 0 ? (
                <p className="px-4 py-6 text-sm text-[#64748b]">配信履歴がありません。</p>
              ) : (
                <ul>
                  {deliveryHistory.map((row) => {
                    const status = resolveStatus(row.sent, row.failed);
                    return (
                      <li
                        key={row.id}
                        className="flex items-center justify-between gap-3 border-b border-[#f1f5f9] px-4 py-3 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#0f172a]">{row.title}</p>
                          <div className="mt-1 flex items-center gap-2 text-xs text-[#64748b]">
                            <span className={`rounded px-2 py-0.5 font-semibold ${status.color}`}>{status.label}</span>
                            <span>配信日時 {formatDeliveryDate(row.sentAt)}</span>
                          </div>
                        </div>
                        <span className="text-xl leading-none text-[#94a3b8]">›</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <Link
                href="/admin/spot-delivery/triggers/new"
                className="rounded-lg bg-[#0f9f99] px-4 py-2 text-sm font-bold text-white"
              >
                + トリガー配信を作成する
              </Link>
              <p className="text-sm text-[#64748b]">設定一覧 {triggerRows.length}件</p>
            </div>
            <div className="overflow-hidden rounded-lg border border-[#e2e8f0]">
              {triggerRows.length === 0 ? (
                <p className="px-4 py-6 text-sm text-[#64748b]">トリガー配信の設定がありません。</p>
              ) : (
                <ul>
                  {triggerRows.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-3 border-b border-[#f1f5f9] px-4 py-3 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#0f172a]">{row.title}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-[#64748b]">
                          <span
                            className={`rounded px-2 py-0.5 font-semibold ${
                              row.isActive ? "bg-[#ccfbf1] text-[#0f766e]" : "bg-[#f1f5f9] text-[#64748b]"
                            }`}
                          >
                            {row.isActive ? "有効" : "無効"}
                          </span>
                          <span>{formatTriggerType(row.triggerType)}</span>
                          <span>更新 {formatDeliveryDate(row.updatedAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/spot-delivery/triggers/${row.id}`}
                          className="rounded border border-[#cbd5e1] px-2 py-1 text-xs font-semibold text-[#334155]"
                        >
                          編集
                        </Link>
                        <button
                          type="button"
                          disabled={updatingTriggerId === row.id}
                          onClick={() => void toggleTriggerActive(row)}
                          className="rounded border border-[#cbd5e1] px-2 py-1 text-xs font-semibold text-[#334155] disabled:opacity-50"
                        >
                          {row.isActive ? "無効化" : "有効化"}
                        </button>
                        <button
                          type="button"
                          disabled={updatingTriggerId === row.id}
                          onClick={() => void deleteTrigger(row)}
                          className="rounded border border-[#fecaca] px-2 py-1 text-xs font-semibold text-[#b91c1c] disabled:opacity-50"
                        >
                          削除
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
