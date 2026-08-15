import { requireAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";
import PrintQrClient from "./print-qr-client";

export default async function AdminPrintQrPage() {
  const admin = await requireAdminUser();
  const store = await prisma.officialAccount.findUniqueOrThrow({
    where: { id: admin.officialAccountId! },
    select: { name: true, displayName: true, slug: true, visitQrToken: true },
  });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  const checkinUrl = `${baseUrl}/s/${store.slug}?checkinToken=${encodeURIComponent(store.visitQrToken ?? "")}`;
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
