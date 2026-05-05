import { requireAdminUser } from "@/lib/admin-guard";

const draftItems = [
  { title: "雨の日クーポン", status: "下書き" },
  { title: "新メニュー告知", status: "配信待ち" },
  { title: "シルバー到達特典", status: "停止中" },
];

export default async function AdminSpotDeliveryPage() {
  await requireAdminUser();

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">スポット配信</h1>
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {draftItems.map((item) => (
          <article key={item.title} className="rounded-xl border border-[#dbe2ea] bg-white p-4 shadow-sm">
            <p className="text-base font-bold">{item.title}</p>
            <p className="mt-1 text-sm text-[#64748b]">状態: {item.status}</p>
            <button
              type="button"
              className="mt-3 rounded-lg bg-[#0f766e] px-3 py-2 text-sm font-bold text-white"
            >
              編集
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}
