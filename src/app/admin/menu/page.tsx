import { requireAdminUser } from "@/lib/admin-guard";

const menuItems = [
  "管理者追加/無効化",
  "QRトークン更新",
  "ランク閾値確認",
  "ログアウト",
];

export default async function AdminMenuPage() {
  await requireAdminUser();

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">メニュー</h1>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {menuItems.map((item) => (
          <button
            key={item}
            type="button"
            className="rounded-xl border border-[#dbe2ea] bg-white px-4 py-4 text-left font-semibold text-[#0f172a] shadow-sm"
          >
            {item}
          </button>
        ))}
      </section>
    </div>
  );
}
