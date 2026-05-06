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

type Props = {
  deliveryHistory: DeliveryHistory[];
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

export default function SpotDeliveryClient({ deliveryHistory }: Props) {
  const [activeTab, setActiveTab] = useState<"list" | "archive">("list");

  return (
    <div className="w-full space-y-4 p-4">
      <h1 className="mx-auto w-[90%] text-xl font-bold">スポット配信</h1>
      <section className="mx-auto w-[90%] rounded-xl border border-[#dbe2ea] bg-white shadow-sm">
        <div className="border-b border-[#e2e8f0] px-4 pt-3">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setActiveTab("list")}
              className={`border-b-2 px-1 pb-2 text-sm font-semibold ${
                activeTab === "list"
                  ? "border-[#0f766e] text-[#0f172a]"
                  : "border-transparent text-[#94a3b8]"
              }`}
            >
              リスト
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("archive")}
              className={`border-b-2 px-1 pb-2 text-sm font-semibold ${
                activeTab === "archive"
                  ? "border-[#0f766e] text-[#0f172a]"
                  : "border-transparent text-[#94a3b8]"
              }`}
            >
              アーカイブ
            </button>
          </div>
        </div>

        {activeTab === "list" ? (
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
          <div className="p-4">
            <p className="text-sm text-[#64748b]">アーカイブ機能は準備中です。</p>
          </div>
        )}
      </section>
    </div>
  );
}
