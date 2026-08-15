"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export default function AdminSignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!displayName || !email || password.length < 8) return;
    setIsSubmitting(true);
    setMessage(null);

    const redirectTo = `${window.location.origin}/admin/auth/callback?next=/admin/onboarding`;
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: { display_name: displayName },
      },
    });

    if (error) {
      setMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    if (data.session) {
      router.push("/admin/onboarding");
      router.refresh();
      return;
    }

    setMessage("確認メールを送信しました。メール内のリンクから登録を続けてください。");
    setIsSubmitting(false);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center bg-[#f6f8fb] p-4">
      <section className="w-full rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-[#0f172a]">店舗アカウント登録</h1>
        <p className="mt-1 text-sm text-[#64748b]">管理者アカウントを作成します。</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="担当者名"
            required
            className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 outline-none focus:border-[#0f766e]"
          />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="メールアドレス"
            required
            className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 outline-none focus:border-[#0f766e]"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="パスワード（8文字以上）"
            minLength={8}
            required
            className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 outline-none focus:border-[#0f766e]"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#0f766e] px-4 py-2 font-bold text-white disabled:bg-[#94a3b8]"
          >
            {isSubmitting ? "登録中..." : "アカウントを作成"}
          </button>
        </form>
        {message ? <p className="mt-3 text-sm text-[#475569]">{message}</p> : null}
        <p className="mt-4 text-xs text-[#64748b]">
          登録済みの場合は
          <Link href="/admin/login" className="font-semibold text-[#0f766e] underline">
            ログイン
          </Link>
        </p>
      </section>
    </main>
  );
}
