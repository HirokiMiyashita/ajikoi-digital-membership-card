import { requireAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export default async function AdminMembersPage() {
  const adminUser = await requireAdminUser();
  const members = await prisma.user.findMany({
    where: adminUser.officialAccountId
      ? { officialAccountId: adminUser.officialAccountId }
      : undefined,
    orderBy: [{ points: "desc" }, { createdAt: "desc" }],
    select: {
      userId: true,
      displayName: true,
      _count: {
        select: {
          checkIns: true,
        },
      },
      rank: {
        select: {
          name: true,
        },
      },
    },
    take: 500,
  });

  return (
    <div className="space-y-4 p-4">
      <div className="mx-auto flex w-[90%] items-end justify-between">
        <h1 className="text-xl font-bold">会員情報</h1>
        <p className="text-sm text-[#64748b]">全{members.length}件</p>
      </div>
      <section className="mx-auto w-[90%] overflow-hidden rounded-xl border border-[#dbe2ea] bg-white shadow-sm">
        <div className="grid grid-cols-[1fr_auto_auto] border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm font-bold text-[#334155]">
          <p>会員名</p>
          <p className="px-2">ランク</p>
          <p className="px-2">来店数</p>
        </div>
        {members.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[#64748b]">会員データがありません。</p>
        ) : (
          members.map((row) => (
            <div
              key={row.userId}
              className="grid grid-cols-[1fr_auto_auto] border-b border-[#f1f5f9] px-4 py-3 text-sm text-[#0f172a] last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate">{row.displayName}</p>
                <p className="truncate text-xs text-[#94a3b8]">{row.userId}</p>
              </div>
              <p className="px-2">{row.rank.name}</p>
              <p className="px-2 text-right font-semibold">{row._count.checkIns}回</p>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
