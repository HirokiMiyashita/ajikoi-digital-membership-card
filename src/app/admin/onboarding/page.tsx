"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminOnboardingPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    const result = (await response.json()) as { message?: string };
    if (!response.ok) {
      setMessage(result.message ?? "店舗の登録に失敗しました。");
      setIsSubmitting(false);
      return;
    }
    router.push("/admin/report");
    router.refresh();
  };

  const inputClass =
    "w-full rounded-lg border border-[#cbd5e1] px-3 py-2 outline-none focus:border-[#0f766e]";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center bg-[#f6f8fb] p-4">
      <section className="w-full rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">店舗の初期設定</h1>
        <p className="mt-1 text-sm text-[#64748b]">
          会員証に表示する店舗情報とLINE連携情報を登録してください。
        </p>
        <form onSubmit={handleSubmit} className="mt-5 grid gap-3">
          <input name="storeName" required placeholder="店舗名" className={inputClass} />
          <input
            name="slug"
            required
            minLength={3}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            placeholder="店舗URL（例: my-store）"
            className={inputClass}
          />
          <input
            name="lineBasicId"
            required
            placeholder="LINE公式アカウントID（例: @example）"
            className={inputClass}
          />
          <input name="liffId" placeholder="LIFF ID（後から設定可能）" className={inputClass} />
          <input
            name="lineAddFriendUrl"
            type="url"
            placeholder="LINE友だち追加URL"
            className={inputClass}
          />
          <input
            name="lineChannelAccessToken"
            type="password"
            placeholder="LINE Channel Access Token"
            className={inputClass}
          />
          <input
            name="googleReviewUrl"
            type="url"
            placeholder="Google口コミURL"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-[#0f766e] px-4 py-2 font-bold text-white disabled:bg-[#94a3b8]"
          >
            {isSubmitting ? "作成中..." : "店舗を作成"}
          </button>
        </form>
        {message ? <p className="mt-3 text-sm text-[#b91c1c]">{message}</p> : null}
      </section>
    </main>
  );
}
