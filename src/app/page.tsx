import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#f6f8fb] px-6 py-20 text-[#0f172a]">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-bold text-[#0f766e]">DIGITAL MEMBERSHIP CARD</p>
        <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight sm:text-6xl">
          お店のファンを育てる、デジタル会員証。
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-[#475569]">
          LINEと連携した会員証、来店ポイント、ギフト、顧客管理を店舗ごとにまとめて運用できます。
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/admin/signup"
            className="rounded-xl bg-[#0f766e] px-6 py-3 font-bold text-white"
          >
            無料で店舗登録
          </Link>
          <Link
            href="/admin/login"
            className="rounded-xl border border-[#cbd5e1] bg-white px-6 py-3 font-bold"
          >
            管理画面にログイン
          </Link>
        </div>
      </div>
    </main>
  );
}
