"use client";

import Image from "next/image";

export default function PrintQrClient({
  storeName,
  checkinUrl,
  qrDataUrl,
}: {
  storeName: string;
  checkinUrl: string;
  qrDataUrl: string;
}) {
  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 rounded-xl border border-[#dbe2ea] bg-white p-4 shadow-sm">
      <h1 className="text-xl font-bold text-[#0f172a]">QRコードを印刷</h1>
      <p className="text-sm text-[#475569]">
        {storeName}専用の来店QRコードです。店舗掲示用として印刷できます。
      </p>

      <div className="mx-auto w-full max-w-md rounded-lg border border-[#e2e8f0] bg-white p-4">
        <Image
          src={qrDataUrl}
          alt="来店チェックインQRコード"
          width={720}
          height={720}
          unoptimized
          className="h-auto w-full"
        />
      </div>
      <p className="break-all text-xs text-[#64748b]">{checkinUrl}</p>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-[#0f9f99] px-4 py-2 text-sm font-bold text-white hover:bg-[#0c8a85]"
        >
          印刷する
        </button>
      </div>
    </section>
  );
}
