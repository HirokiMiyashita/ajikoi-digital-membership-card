"use client";

import Link from "next/link";
import { useState } from "react";

type DeliveryHistory = {
  id: string;
  title: string;
  notificationText: string;
  messages: unknown;
  sentAt: string;
  sent: number;
  failed: number;
};
type LineMessage =
  | { type: "text"; text: string }
  | { type: "image"; originalContentUrl: string; previewImageUrl: string }
  | { type: "flex"; altText: string; contents: unknown };
type TriggerSetting = {
  id: string;
  title: string;
  triggerType: "USER_SIGNUP" | "CHECKIN_POINT_GRANTED" | "RANK_UP" | "BIRTHDAY" | "GIFT_EXPIRES";
  notificationText: string;
  messages: unknown;
  message: string;
  targetRankIds: string[];
  targetGender: string | null;
  targetVisitCountSegments: Array<"ZERO" | "ONE" | "TWO_TO_FOUR" | "FIVE_TO_NINE" | "TEN_OR_MORE">;
  delayDays: number;
  deliveryHourJst: number | null;
  isActive: boolean;
  updatedAt: string;
};

type Props = {
  deliveryHistory: DeliveryHistory[];
  triggerSettings: TriggerSetting[];
  monthlyLimit: number;
  monthlyUsed: number;
  monthlyRemaining: number;
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

function normalizeMessages(value: unknown): LineMessage[] {
  if (!Array.isArray(value)) return [];
  return value.filter((message): message is LineMessage => {
    if (!message || typeof message !== "object" || !("type" in message)) return false;
    return message.type === "text" || message.type === "image" || message.type === "flex";
  });
}

function collectFlexTexts(value: unknown, texts: string[] = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectFlexTexts(item, texts));
    return texts;
  }
  if (!value || typeof value !== "object") return texts;
  const record = value as Record<string, unknown>;
  if (typeof record.text === "string" && !texts.includes(record.text)) {
    texts.push(record.text);
  }
  Object.values(record).forEach((item) => collectFlexTexts(item, texts));
  return texts;
}

function findFlexImageUrl(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFlexImageUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.type === "image" && typeof record.url === "string") return record.url;
  for (const item of Object.values(record)) {
    const found = findFlexImageUrl(item);
    if (found) return found;
  }
  return null;
}

function formatTriggerType(triggerType: TriggerSetting["triggerType"]) {
  if (triggerType === "USER_SIGNUP") return "会員登録時";
  if (triggerType === "CHECKIN_POINT_GRANTED") return "来店ポイント付与時";
  if (triggerType === "RANK_UP") return "ランクアップ時";
  if (triggerType === "BIRTHDAY") return "誕生日";
  return "ギフト期限切れ";
}

export default function SpotDeliveryClient({
  deliveryHistory,
  triggerSettings,
  monthlyLimit,
  monthlyUsed,
  monthlyRemaining,
}: Props) {
  const [activeTab, setActiveTab] = useState<"spot" | "trigger">("spot");
  const [triggerRows, setTriggerRows] = useState(triggerSettings);
  const [updatingTriggerId, setUpdatingTriggerId] = useState<string | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryHistory | null>(null);

  const toggleTriggerActive = async (row: TriggerSetting) => {
    setUpdatingTriggerId(row.id);
    try {
      const response = await fetch(`/api/admin/spot-delivery/triggers/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: row.title,
          triggerType: row.triggerType,
          notificationText: row.notificationText ?? "",
          messages: Array.isArray(row.messages)
            ? row.messages
            : [{ type: "text", text: row.message ?? "" }],
          targetRankIds: row.targetRankIds,
          targetGender: row.targetGender,
          targetVisitCountSegments: row.targetVisitCountSegments,
          delayDays: row.delayDays,
          deliveryHourJst: row.deliveryHourJst,
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
      <div className="mx-auto flex w-[90%] items-end justify-between">
        <h1 className="text-xl font-bold">LINE配信</h1>
        <p className="text-xs text-[#64748b]">
          残り配信可能数 {monthlyRemaining}/{monthlyLimit}（今月送信 {monthlyUsed}通）
        </p>
      </div>
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
                      <li key={row.id} className="border-b border-[#f1f5f9] last:border-b-0">
                        <button
                          type="button"
                          onClick={() => setSelectedDelivery(row)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[#f8fafc]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#0f172a]">{row.title}</p>
                            <div className="mt-1 flex items-center gap-2 text-xs text-[#64748b]">
                              <span className={`rounded px-2 py-0.5 font-semibold ${status.color}`}>{status.label}</span>
                              <span>配信日時 {formatDeliveryDate(row.sentAt)}</span>
                            </div>
                          </div>
                          <span className="text-xl leading-none text-[#94a3b8]">›</span>
                        </button>
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
      {selectedDelivery ? (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedDelivery(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delivery-detail-title"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#64748b]">配信履歴</p>
                <h2 id="delivery-detail-title" className="mt-1 text-lg font-bold text-[#0f172a]">
                  {selectedDelivery.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDelivery(null)}
                aria-label="閉じる"
                className="flex size-8 items-center justify-center rounded-full bg-[#f1f5f9] text-xl text-[#475569]"
              >
                ×
              </button>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-[#f8fafc] p-4 text-sm">
              <div>
                <dt className="text-xs text-[#64748b]">配信日時</dt>
                <dd className="mt-1 font-semibold">{formatDeliveryDate(selectedDelivery.sentAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#64748b]">配信結果</dt>
                <dd className="mt-1 font-semibold">
                  成功 {selectedDelivery.sent}件 / 失敗 {selectedDelivery.failed}件
                </dd>
              </div>
            </dl>

            {selectedDelivery.notificationText ? (
              <div className="mt-4">
                <p className="text-xs font-semibold text-[#64748b]">管理用メモ</p>
                <p className="mt-1 whitespace-pre-wrap rounded-lg border border-[#e2e8f0] p-3 text-sm">
                  {selectedDelivery.notificationText}
                </p>
              </div>
            ) : null}

            <div className="mt-5">
              <h3 className="text-sm font-bold text-[#0f172a]">配信内容</h3>
              <div className="mt-2 space-y-3">
                {normalizeMessages(selectedDelivery.messages).map((message, index) => {
                  if (message.type === "text") {
                    return (
                      <div key={index} className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                        <p className="text-xs font-semibold text-[#64748b]">テキスト</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-[#1f2937]">{message.text}</p>
                      </div>
                    );
                  }
                  const imageUrl =
                    message.type === "image"
                      ? message.previewImageUrl || message.originalContentUrl
                      : findFlexImageUrl(message.contents);
                  const flexTexts =
                    message.type === "flex" ? collectFlexTexts(message.contents) : [];
                  return (
                    <div key={index} className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
                      {imageUrl ? (
                        <div
                          className="h-48 w-full bg-[#f1f5f9] bg-contain bg-center bg-no-repeat"
                          style={{ backgroundImage: `url("${imageUrl.replaceAll('"', "%22")}")` }}
                          role="img"
                          aria-label={message.type === "flex" ? message.altText : "配信画像"}
                        />
                      ) : null}
                      <div className="p-4">
                        <p className="text-xs font-semibold text-[#64748b]">
                          {message.type === "flex" ? "Flexメッセージ" : "画像"}
                        </p>
                        {message.type === "flex" ? (
                          <>
                            <p className="mt-1 text-sm font-semibold">{message.altText}</p>
                            {flexTexts.length > 0 ? (
                              <div className="mt-2 space-y-1 text-sm text-[#475569]">
                                {flexTexts.map((text) => (
                                  <p key={text}>{text}</p>
                                ))}
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {normalizeMessages(selectedDelivery.messages).length === 0 ? (
                  <p className="rounded-lg bg-[#f8fafc] p-4 text-sm text-[#64748b]">
                    配信内容が履歴に保存されていません。
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
