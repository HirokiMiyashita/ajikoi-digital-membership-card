import Link from "next/link";
import { requireAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";
import PrintQrClient from "./print-qr-client";

export default async function AdminPrintQrPage() {
  const admin = await requireAdminUser();
  const store = await prisma.officialAccount.findUniqueOrThrow({
    where: { id: admin.officialAccountId! },
    select: {
      name: true,
      displayName: true,
      visitQrToken: true,
      liffId: true,
    },
  });
  if (!store.liffId) {
    return (
      <div className="p-4">
        <section className="mx-auto w-full max-w-3xl rounded-xl border border-[#dbe2ea] bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-[#0f172a]">QRコードを印刷</h1>
          <p className="mt-3 text-sm text-[#475569]">
            来店QRコードを発行するには、先に店舗設定でLIFF IDを登録してください。
          </p>
          <Link
            href="/admin/store-settings"
            className="mt-4 inline-flex rounded-lg bg-[#0f766e] px-4 py-2 text-sm font-bold text-white"
          >
            店舗設定を開く
          </Link>
        </section>
      </div>
    );
  }
  const checkinUrl = `https://liff.line.me/${store.liffId}?checkinToken=${encodeURIComponent(store.visitQrToken ?? "")}`;
  const qrDataUrl = await QRCode.toDataURL(checkinUrl, { width: 720, margin: 2 });

  return (
    <div className="p-4">
      <PrintQrClient
        storeName={store.displayName ?? store.name ?? store.slug}
        checkinUrl={checkinUrl}
        qrDataUrl={qrDataUrl}
      />
    </div>
  );
}
