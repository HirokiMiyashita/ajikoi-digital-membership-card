"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function AdminSetupPage() {
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [officialAccountLineId, setOfficialAccountLineId] = useState("");
  const [setupKey, setSetupKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch("/api/admin/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminId,
          password,
          officialAccountLineId,
          setupKey,
        }),
      });
      let json: { ok: boolean; message?: string } | null = null;
      try {
        json = (await response.json()) as { ok: boolean; message?: string };
      } catch {
        json = null;
      }
      if (!response.ok || !json?.ok) {
        setIsError(true);
        setMessage(
          json?.message ?? `セットアップに失敗しました。（HTTP ${response.status}）`,
        );
        return;
      }

      setMessage("管理者アカウントを作成しました。ログイン画面へ進んでください。");
    } catch {
      setIsError(true);
      setMessage("通信エラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center bg-[#f6f8fb] p-4">
      <section className="w-full rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-[#0f172a]">管理画面セットアップ</h1>
        <p className="mt-1 text-sm text-[#64748b]">
          管理者IDとパスワードを作成します。`ADMIN_SETUP_KEY` が必要です。
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            value={adminId}
            onChange={(event) => setAdminId(event.target.value)}
            placeholder="管理者ID"
            className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 outline-none focus:border-[#0f766e]"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="パスワード"
            className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 outline-none focus:border-[#0f766e]"
          />
          <input
            value={officialAccountLineId}
            onChange={(event) => setOfficialAccountLineId(event.target.value)}
            placeholder="公式アカウントID（@xxxx）"
            className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 outline-none focus:border-[#0f766e]"
          />
          <input
            type="password"
            value={setupKey}
            onChange={(event) => setSetupKey(event.target.value)}
            placeholder="セットアップキー"
            className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 outline-none focus:border-[#0f766e]"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#0f766e] px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
          >
            {isSubmitting ? "作成中..." : "管理者を作成"}
          </button>
        </form>

        {message ? (
          <p className={`mt-3 text-sm ${isError ? "text-[#b91c1c]" : "text-[#0f766e]"}`}>{message}</p>
        ) : null}

        <p className="mt-4 text-xs text-[#64748b]">
          <Link href="/admin/login" className="font-semibold text-[#0f766e] underline">
            ログイン画面へ
          </Link>
        </p>
      </section>
    </main>
  );
}
