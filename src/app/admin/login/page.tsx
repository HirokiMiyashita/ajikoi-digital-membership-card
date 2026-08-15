"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";

function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const error = searchParams.get("error");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !password) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      const { error: signInError } = await createClient().auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setMessage("ログインに失敗しました。メールアドレスとパスワードをご確認ください。");
        return;
      }

      router.push("/admin/report");
      router.refresh();
    } catch {
      setMessage("ログイン処理でエラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center bg-[#f6f8fb] p-4">
      <section className="w-full rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-[#0f172a]">管理画面ログイン</h1>
        <p className="mt-1 text-sm text-[#64748b]">メールアドレスとパスワードでログインしてください。</p>

        {error === "not-allowed" ? (
          <p className="mt-3 rounded-lg bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]">
            店舗管理者情報が見つかりません。店舗登録を完了してください。
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#334155]">メールアドレス</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 outline-none focus:border-[#0f766e]"
              placeholder="owner@example.com"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#334155]">パスワード</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 outline-none focus:border-[#0f766e]"
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#0f766e] px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
          >
            {isSubmitting ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        {message ? <p className="mt-3 text-sm text-[#b91c1c]">{message}</p> : null}

        <p className="mt-4 text-xs text-[#64748b]">
          初めての方は
          <Link href="/admin/signup" className="font-semibold text-[#0f766e] underline">
            店舗アカウント登録
          </Link>
          をご利用ください。
        </p>
      </section>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center bg-[#f6f8fb] p-4">
          <section className="w-full rounded-2xl bg-white p-6 text-sm text-[#64748b] shadow-sm">
            ログイン画面を読み込み中...
          </section>
        </main>
      }
    >
      <AdminLoginContent />
    </Suspense>
  );
}
