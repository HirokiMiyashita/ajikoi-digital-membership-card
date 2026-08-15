import { requireAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function AdminGiftsPage() {
  const admin = await requireAdminUser();

  const gifts = await prisma.gift.findMany({
    where: { officialAccountId: admin.officialAccountId! },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      expiryType: true,
      expiryDays: true,
      expiryAt: true,
      updatedAt: true,
    },
  });

  return (
    <div className="w-full space-y-4 p-4">
      <div className="mx-auto flex w-[90%] items-center justify-between">
        <h1 className="text-xl font-bold">ギフト管理</h1>
        <Link
          href="/admin/gifts/new"
          className="rounded-lg bg-[#0f766e] px-4 py-2 text-sm font-bold text-white"
        >
          ギフトを作成
        </Link>
      </div>

      <section className="mx-auto w-[90%] rounded-xl border border-[#dbe2ea] bg-white p-4 shadow-sm">
        {gifts.length === 0 ? (
          <p className="text-sm text-[#64748b]">作成済みのギフトはありません。</p>
        ) : (
          <div className="space-y-2">
            {gifts.map((gift) => (
              <Link
                key={gift.id}
                href={`/admin/gifts/${gift.id}`}
                className="block rounded-lg border border-[#e2e8f0] px-4 py-3 hover:bg-[#f8fafc]"
              >
                <p className="font-semibold text-[#0f172a]">{gift.title}</p>
                <p className="mt-1 text-sm text-[#64748b]">
                  {gift.expiryType === "DAYS_AFTER_ISSUE"
                    ? `配布から ${gift.expiryDays ?? "-"} 日`
                    : `特定日付 ${gift.expiryAt?.toISOString().slice(0, 10) ?? "-"}`}
                </p>
                <p className="mt-1 text-xs text-[#94a3b8]">
                  更新日 {gift.updatedAt.toISOString().slice(0, 10)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
