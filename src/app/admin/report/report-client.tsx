"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { rpcClient } from "@/orpc/client";

type ReportMetrics = {
  memberTrend: Array<{ day: string; members: number }>;
  repeaterTrend: Array<{ day: string; repeaters: number }>;
  visitTrend: Array<{ day: string; newVisits: number; repeatVisits: number; totalVisits: number }>;
  repeaterSummary: {
    visitors: number;
    repeaters: number;
    repeatRate: number;
  };
  visitCountDistribution: Array<{ label: string; count: number }>;
  ageDistribution: Array<{ label: string; count: number }>;
  genderDistribution: Array<{ label: string; count: number }>;
  revisitFrequency: {
    usersCount: number;
    avgVisitsIn30Days: number;
  };
  latestDelivery: {
    sentAt: string;
    message: string;
    sent: number;
    opened: number | null;
    visits: number;
    statusLabel: string;
  } | null;
};

type Props = {
  initialData?: ReportMetrics;
};

function toLabel(day: string) {
  return day.slice(5, 10);
}

type VisitGranularity = "day" | "week" | "month";

function parseDayToUtc(day: string) {
  const ymd = day.slice(0, 10);
  return new Date(`${ymd}T00:00:00Z`);
}

function formatMonthDay(date: Date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${month}/${day}`;
}

function formatMonthLabel(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${String(year).slice(2)}/${month}`;
}

function getWeekStartUtc(date: Date) {
  const result = new Date(date);
  const day = result.getUTCDay();
  const diff = (day + 6) % 7;
  result.setUTCDate(result.getUTCDate() - diff);
  return result;
}

function formatRecentDeliverySentAt(iso: string) {
  const date = new Date(iso);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hour}:${minute}`;
}

export default function ReportClient({ initialData }: Props) {
  const [data, setData] = useState<ReportMetrics | null>(initialData ?? null);
  const [loading, setLoading] = useState(initialData ? false : true);
  const [error, setError] = useState<string | null>(null);
  const [visitGranularity, setVisitGranularity] = useState<VisitGranularity>("day");
  const [showNewVisits, setShowNewVisits] = useState(true);
  const [showRepeatVisits, setShowRepeatVisits] = useState(true);

  useEffect(() => {
    if (initialData) {
      return;
    }
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
  }, [initialData]);

  const memberTrend = data?.memberTrend ?? [];
  const repeaterTrend = data?.repeaterTrend ?? [];
  const visitTrend = useMemo(() => data?.visitTrend ?? [], [data]);
  const repeaterSummary = data?.repeaterSummary ?? {
    visitors: 0,
    repeaters: 0,
    repeatRate: 0,
  };
  const visitCountDistribution = data?.visitCountDistribution ?? [];
  const ageDistribution = data?.ageDistribution ?? [];
  const genderDistribution = data?.genderDistribution ?? [];
  const revisitFrequency = data?.revisitFrequency ?? {
    usersCount: 0,
    avgVisitsIn30Days: 0,
  };
  const latestDelivery = data?.latestDelivery ?? null;

  const memberChartData = memberTrend.map((row, index) => ({
    day: toLabel(row.day),
    members: row.members,
    repeaters: repeaterTrend[index]?.repeaters ?? 0,
  }));
  const visitChartData = useMemo(() => {
    if (visitGranularity === "day") {
      return visitTrend.slice(-14).map((row) => ({
        key: row.day,
        label: toLabel(row.day),
        newVisits: row.newVisits,
        repeatVisits: row.repeatVisits,
        totalVisits: row.totalVisits,
      }));
    }

    const grouped = new Map<
      string,
      { key: string; label: string; newVisits: number; repeatVisits: number; totalVisits: number }
    >();

    for (const row of visitTrend) {
      const date = parseDayToUtc(row.day);
      if (visitGranularity === "week") {
        const weekStart = getWeekStartUtc(date);
        const key = weekStart.toISOString().slice(0, 10);
        const label = `${formatMonthDay(weekStart)}週`;
        const current = grouped.get(key) ?? { key, label, newVisits: 0, repeatVisits: 0, totalVisits: 0 };
        current.newVisits += row.newVisits;
        current.repeatVisits += row.repeatVisits;
        current.totalVisits += row.totalVisits;
        grouped.set(key, current);
      } else {
        const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
        const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
        const label = formatMonthLabel(monthStart);
        const current = grouped.get(key) ?? { key, label, newVisits: 0, repeatVisits: 0, totalVisits: 0 };
        current.newVisits += row.newVisits;
        current.repeatVisits += row.repeatVisits;
        current.totalVisits += row.totalVisits;
        grouped.set(key, current);
      }
    }

    if (visitGranularity === "week") {
      const sorted = [...grouped.values()].sort((a, b) => a.key.localeCompare(b.key));
      return sorted.slice(-12);
    }

    const now = new Date();
    const months = Array.from({ length: 12 }, (_, index) => {
      const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - index), 1));
      const key = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}`;
      const found = grouped.get(key);
      return (
        found ?? {
          key,
          label: formatMonthLabel(monthDate),
          newVisits: 0,
          repeatVisits: 0,
          totalVisits: 0,
        }
      );
    });

    return months;
  }, [visitGranularity, visitTrend]);

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
  const visitorsDisplay = repeaterSummary.visitors.toLocaleString();
  const repeatersDisplay = repeaterSummary.repeaters.toLocaleString();
  const visitDonutColors = ["#0f9f99", "#ea7b47", "#f59e0b", "#818cf8", "#f472b6"];
  const ageDonutColors = ["#0f9f99", "#ea7b47", "#f59e0b", "#818cf8", "#f472b6", "#38bdf8", "#94a3b8"];
  const genderDonutColors = ["#0f9f99", "#ea7b47", "#94a3b8"];

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">レポート</h1>
      <div className="mx-auto w-[90%] space-y-2">
        <h2 className="text-lg font-bold">会員数の推移</h2>
        <section className="rounded-xl border border-[#dbe2ea] bg-white p-4 shadow-sm">
        <div className="mt-3 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={memberChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                tick={{ fill: "#64748b", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="members"
                name="会員"
                stroke="#0f9f99"
                strokeWidth={3}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="repeaters"
                name="リピート会員"
                stroke="#ea7b47"
                strokeWidth={3}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:gap-3">
          <article className="rounded-xl bg-[#0f9f99] p-4 text-white shadow-sm">
            <p className="text-sm font-semibold">来店会員</p>
            <p className="mt-2 flex items-end gap-1">
              <span className="text-4xl font-bold leading-none">{visitorsDisplay}</span>
              <span className="pb-0.5 text-base font-semibold">人</span>
            </p>
          </article>
          <article className="rounded-xl bg-[#ea7b47] p-4 text-white shadow-sm">
            <p className="text-sm font-semibold">リピート会員</p>
            <div className="mt-2 flex items-end justify-between gap-1">
              <p className="flex items-end gap-1">
                <span className="text-4xl font-bold leading-none">{repeatersDisplay}</span>
                <span className="pb-0.5 text-base font-semibold">人</span>
              </p>
              <p className="pb-0.5 text-base font-semibold">{repeaterSummary.repeatRate.toFixed(2)}%</p>
            </div>
          </article>
        </div>
        </section>
      </div>

      <div className="mx-auto w-[90%] space-y-2">
        <h2 className="text-lg font-bold">直近の配信</h2>
        <section className="rounded-xl border border-[#dbe2ea] bg-white p-4 shadow-sm">
          {latestDelivery ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-bold">{formatRecentDeliverySentAt(latestDelivery.sentAt)} の配信</p>
                <div className="flex items-center gap-2 text-sm text-[#64748b]">
                  <span>{formatRecentDeliverySentAt(latestDelivery.sentAt)}</span>
                  <span className="rounded bg-[#ecfeff] px-2 py-0.5 text-xs font-semibold text-[#0f766e]">
                    {latestDelivery.statusLabel}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-base font-semibold text-[#0f172a]">{latestDelivery.message}</p>
              <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#f8fafc]">
                <div className="px-4 py-3">
                  <p className="text-sm text-[#64748b]">配信</p>
                  <p className="text-3xl font-bold text-[#0f172a]">{latestDelivery.sent.toLocaleString()}</p>
                </div>
                <div className="border-x border-[#e2e8f0] px-4 py-3">
                  <p className="text-sm text-[#64748b]">既読</p>
                  <p className="text-3xl font-bold text-[#0f172a]">
                    {latestDelivery.opened === null ? "-" : latestDelivery.opened.toLocaleString()}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm text-[#64748b]">来店</p>
                  <p className="text-3xl font-bold text-[#0f172a]">{latestDelivery.visits.toLocaleString()}</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-[#64748b]">配信履歴がありません。</p>
          )}
        </section>
      </div>

      <div className="mx-auto w-[90%] space-y-2">
        <h2 className="text-lg font-bold">来店数の推移（初回来店 / 2回目以降）</h2>
        <section className="rounded-xl border border-[#dbe2ea] bg-white p-4 shadow-sm">
        <p className="mt-1 text-sm text-[#64748b]">会員登録日ではなく、チェックイン回数を基準に集計しています。</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#dbe2ea] bg-[#f8fafc] p-1 text-sm">
            <button
              type="button"
              onClick={() => setVisitGranularity("day")}
              className={`rounded-md px-3 py-1 font-semibold ${
                visitGranularity === "day" ? "bg-white text-[#0f172a] shadow-sm" : "text-[#64748b]"
              }`}
            >
              日
            </button>
            <button
              type="button"
              onClick={() => setVisitGranularity("week")}
              className={`rounded-md px-3 py-1 font-semibold ${
                visitGranularity === "week" ? "bg-white text-[#0f172a] shadow-sm" : "text-[#64748b]"
              }`}
            >
              週
            </button>
            <button
              type="button"
              onClick={() => setVisitGranularity("month")}
              className={`rounded-md px-3 py-1 font-semibold ${
                visitGranularity === "month" ? "bg-white text-[#0f172a] shadow-sm" : "text-[#64748b]"
              }`}
            >
              月
            </button>
          </div>

          <label className="ml-auto inline-flex items-center gap-2 text-sm text-[#334155]">
            <input
              type="checkbox"
              checked={showNewVisits}
              onChange={(event) => setShowNewVisits(event.target.checked)}
              className="h-4 w-4 rounded border-[#cbd5e1] text-[#0f9f99]"
            />
            初回来店
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-[#334155]">
            <input
              type="checkbox"
              checked={showRepeatVisits}
              onChange={(event) => setShowRepeatVisits(event.target.checked)}
              className="h-4 w-4 rounded border-[#cbd5e1] text-[#ea7b47]"
            />
            2回目以降
          </label>
        </div>
        <div className="mt-3 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visitChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip />
              {showNewVisits ? (
                <Bar dataKey="newVisits" stackId="visits" name="初回来店" fill="#0f9f99" radius={[4, 4, 0, 0]} />
              ) : null}
              {showRepeatVisits ? (
                <Bar dataKey="repeatVisits" stackId="visits" name="2回目以降" fill="#ea7b47" radius={[4, 4, 0, 0]} />
              ) : null}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {!showNewVisits && !showRepeatVisits ? (
          <p className="mt-2 text-sm text-[#64748b]">表示する系列を1つ以上選択してください。</p>
        ) : null}
        </section>
      </div>
      <section className="space-y-3">
        <article className="mx-auto w-[90%] rounded-xl border border-[#dbe2ea] bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-[#334155]">30日以内に再来店した人の来店頻度</p>
          <div className="mt-2 flex items-end gap-2">
            <p className="text-4xl font-bold text-[#0f172a]">{revisitFrequency.avgVisitsIn30Days.toFixed(2)}</p>
            <p className="pb-1 text-sm text-[#334155]">日に1回</p>
            <p className="pb-1 text-xs text-[#94a3b8]">※計測対象{revisitFrequency.usersCount}人</p>
          </div>
        </article>

        <div className="mx-auto w-[90%] space-y-2">
          <h2 className="text-lg font-bold">来店回数</h2>
          <article className="rounded-xl border border-[#dbe2ea] bg-white p-4 shadow-sm">
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[200px_1fr] sm:items-center">
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={visitCountDistribution}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={56}
                    paddingAngle={2}
                  >
                    {visitCountDistribution.map((entry, index) => (
                      <Cell key={`${entry.label}-${entry.count}`} fill={visitDonutColors[index % visitDonutColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              {visitCountDistribution.map((row, index) => (
                <p key={row.label} className="flex items-center gap-2 text-[#334155]">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: visitDonutColors[index % visitDonutColors.length] }}
                  />
                  {row.label} {row.count}
                </p>
              ))}
            </div>
          </div>
          </article>
        </div>

        <div className="mx-auto w-[90%] space-y-2">
          <h2 className="text-lg font-bold">会員の年代</h2>
          <article className="rounded-xl border border-[#dbe2ea] bg-white p-4 shadow-sm">
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[200px_1fr] sm:items-center">
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ageDistribution}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={56}
                    paddingAngle={2}
                  >
                    {ageDistribution.map((entry, index) => (
                      <Cell key={`${entry.label}-${entry.count}`} fill={ageDonutColors[index % ageDonutColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              {ageDistribution.map((row, index) => (
                <p key={row.label} className="flex items-center gap-2 text-[#334155]">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: ageDonutColors[index % ageDonutColors.length] }}
                  />
                  {row.label} {row.count}
                </p>
              ))}
            </div>
          </div>
          </article>
        </div>

        <div className="mx-auto w-[90%] space-y-2">
          <h2 className="text-lg font-bold">会員の性別</h2>
          <article className="rounded-xl border border-[#dbe2ea] bg-white p-4 shadow-sm">
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[200px_1fr] sm:items-center">
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderDistribution}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={56}
                    paddingAngle={2}
                  >
                    {genderDistribution.map((entry, index) => (
                      <Cell key={`${entry.label}-${entry.count}`} fill={genderDonutColors[index % genderDonutColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              {genderDistribution.map((row, index) => (
                <p key={row.label} className="flex items-center gap-2 text-[#334155]">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: genderDonutColors[index % genderDonutColors.length] }}
                  />
                  {row.label} {row.count}
                </p>
              ))}
            </div>
          </div>
          </article>
        </div>
      </section>
    </div>
  );
}
