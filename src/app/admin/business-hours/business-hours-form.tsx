"use client";

import { useState } from "react";

type BusinessHourRow = {
  day: string;
  label: string;
  isClosed: boolean;
  openingTime: string;
  closingTime: string;
};

export default function BusinessHoursForm({ initialRows }: { initialRows: BusinessHourRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const updateRow = (day: string, update: Partial<BusinessHourRow>) => {
    setRows((current) =>
      current.map((row) => (row.day === day ? { ...row, ...update } : row)),
    );
  };

  const save = async () => {
    setIsSaving(true);
    setMessage(null);
    const response = await fetch("/api/admin/business-hours", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hours: rows }),
    });
    const result = (await response.json()) as { message?: string };
    setMessage(response.ok ? "営業時間を保存しました。" : result.message ?? "保存に失敗しました。");
    setIsSaving(false);
  };

  return (
    <section className="max-w-2xl rounded-xl bg-white p-5 shadow-sm">
      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.day}
            className="grid grid-cols-[5rem_1fr] items-center gap-3 rounded-lg border border-[#e2e8f0] p-3 sm:grid-cols-[6rem_7rem_1fr]"
          >
            <p className="font-semibold">{row.label}</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={row.isClosed}
                onChange={(event) => updateRow(row.day, { isClosed: event.target.checked })}
              />
              休業日
            </label>
            <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
              <input
                type="time"
                value={row.openingTime}
                disabled={row.isClosed}
                onChange={(event) => updateRow(row.day, { openingTime: event.target.value })}
                className="min-w-0 flex-1 rounded border border-[#cbd5e1] px-2 py-2 disabled:bg-[#f1f5f9]"
              />
              <span>〜</span>
              <input
                type="time"
                value={row.closingTime}
                disabled={row.isClosed}
                onChange={(event) => updateRow(row.day, { closingTime: event.target.value })}
                className="min-w-0 flex-1 rounded border border-[#cbd5e1] px-2 py-2 disabled:bg-[#f1f5f9]"
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-[#64748b]">
        終了時刻を開始時刻より早くすると、翌日までの営業時間として扱います。
      </p>
      <button
        type="button"
        onClick={() => void save()}
        disabled={isSaving}
        className="mt-4 rounded-lg bg-[#0f766e] px-5 py-2 font-bold text-white disabled:bg-[#94a3b8]"
      >
        {isSaving ? "保存中..." : "営業時間を保存"}
      </button>
      {message ? <p className="mt-3 text-sm text-[#475569]">{message}</p> : null}
    </section>
  );
}
