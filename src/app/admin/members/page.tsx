import { requireAdminUser } from "@/lib/admin-guard";

const memberRows = [
  { name: "テスト会員A", rank: "レギュラー", points: 1 },
  { name: "テスト会員B", rank: "シルバー", points: 6 },
  { name: "テスト会員C", rank: "ダイヤモンド", points: 52 },
];

export default async function AdminMembersPage() {
  await requireAdminUser();

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">会員情報</h1>
      <section className="overflow-hidden rounded-xl border border-[#dbe2ea] bg-white shadow-sm">
        <div className="grid grid-cols-[1fr_auto_auto] border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm font-bold text-[#334155]">
          <p>会員名</p>
          <p className="px-2">ランク</p>
          <p className="px-2">ポイント</p>
        </div>
        {memberRows.map((row) => (
          <div
            key={row.name}
            className="grid grid-cols-[1fr_auto_auto] border-b border-[#f1f5f9] px-4 py-3 text-sm text-[#0f172a] last:border-b-0"
          >
            <p>{row.name}</p>
            <p className="px-2">{row.rank}</p>
            <p className="px-2 text-right font-semibold">{row.points}P</p>
          </div>
        ))}
      </section>
    </div>
  );
}
