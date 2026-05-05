"use client";

import { useEffect, useState } from "react";

import { rpcClient } from "@/orpc/client";

type ReportMetrics = {
  memberTrend: Array<{ day: string; members: number }>;
  visitTrend: Array<{ day: string; newVisits: number; repeatVisits: number; totalVisits: number }>;
  revisitFrequency: {
    usersCount: number;
    avgVisitsIn30Days: number;
    totalVisitsIn30Days: number;
  };
};

export default function ReportClient() {
  const [data, setData] = useState<ReportMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await rpcClient.admin.reportMetrics({});
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "レポートの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    void fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="p-4">
        <div className="rounded-xl border border-[#dbe2ea] bg-white p-5 text-sm text-[#64748b] shadow-sm">
          レポートを読み込み中...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4">
        <div className="rounded-xl border border-[#fecaca] bg-[#fff1f2] p-5 text-sm text-[#b91c1c] shadow-sm">
          {error ?? "レポートの表示に失敗しました。"}
        </div>
      </div>
    );
  }

  const { memberTrend, visitTrend, revisitFrequency } = data;
  const latestMember = memberTrend[memberTrend.length - 1]?.members ?? 0;
  const latestVisit = visitTrend[visitTrend.length - 1] ?? {
    day: "",
    newVisits: 0,
    repeatVisits: 0,
    totalVisits: 0,
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">レポート</h1>
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-xl border border-[#dbe2ea] bg-white p-4 shadow-sm">
          <p className="text-sm text-[#64748b]">会員数（最新）</p>
          <p className="mt-2 text-3xl font-bold text-[#0f172a]">{latestMember}</p>
          <p className="mt-1 text-xs text-[#94a3b8]">14日推移の最新値</p>
        </article>
        <article className="rounded-xl border border-[#dbe2ea] bg-white p-4 shadow-sm">
          <p className="text-sm text-[#64748b]">来店数（本日）</p>
          <p className="mt-2 text-3xl font-bold text-[#0f172a]">{latestVisit.totalVisits}</p>
          <p className="mt-1 text-xs text-[#94a3b8]">
            新規 {latestVisit.newVisits} / リピータ {latestVisit.repeatVisits}
          </p>
        </article>
        <article className="rounded-xl border border-[#dbe2ea] bg-white p-4 shadow-sm">
          <p className="text-sm text-[#64748b]">30日以内再来店の来店頻度</p>
          <p className="mt-2 text-3xl font-bold text-[#0f172a]">{revisitFrequency.avgVisitsIn30Days}</p>
          <p className="mt-1 text-xs text-[#94a3b8]">
            対象ユーザー {revisitFrequency.usersCount}人 / 合計来店 {revisitFrequency.totalVisitsIn30Days}
          </p>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-[#dbe2ea] bg-white p-4 shadow-sm">
          <h2 className="font-bold">会員数の推移（14日）</h2>
          <div className="mt-3 space-y-2 text-sm">
            {memberTrend.map((row) => (
              <div key={row.day} className="grid grid-cols-[92px_1fr_auto] items-center gap-2">
                <p className="text-[#64748b]">{row.day.slice(5, 10)}</p>
                <div className="h-2 rounded-full bg-[#e2e8f0]">
                  <div
                    className="h-2 rounded-full bg-[#0f766e]"
                    style={{
                      width: `${Math.max(
                        8,
                        Math.round(
                          ((row.members ?? 0) /
                            Math.max(...memberTrend.map((item) => item.members), 1)) *
                            100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
                <p className="font-semibold">{row.members}</p>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-xl border border-[#dbe2ea] bg-white p-4 shadow-sm">
          <h2 className="font-bold">来店数の推移（新規 / リピータ）</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[340px] text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0] text-left text-[#64748b]">
                  <th className="pb-2 font-medium">日付</th>
                  <th className="pb-2 font-medium">新規</th>
                  <th className="pb-2 font-medium">リピータ</th>
                  <th className="pb-2 font-medium">合計</th>
                </tr>
              </thead>
              <tbody>
                {visitTrend.map((row) => (
                  <tr key={row.day} className="border-b border-[#f1f5f9] last:border-b-0">
                    <td className="py-2">{row.day.slice(5, 10)}</td>
                    <td className="py-2">{row.newVisits}</td>
                    <td className="py-2">{row.repeatVisits}</td>
                    <td className="py-2 font-semibold">{row.totalVisits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}
