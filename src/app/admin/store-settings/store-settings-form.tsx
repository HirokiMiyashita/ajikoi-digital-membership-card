"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type StoreSettings = {
  name: string;
  displayName: string;
  logoUrl: string;
  themeColor: string;
  liffId: string;
  lineAddFriendUrl: string;
  googleReviewUrl: string;
};

export default function StoreSettingsForm({
  initialValues,
  memberUrl,
}: {
  initialValues: StoreSettings;
  memberUrl: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/store-settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    const result = (await response.json()) as { message?: string };
    setMessage(response.ok ? "店舗設定を保存しました。" : result.message ?? "保存に失敗しました。");
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4 rounded-xl bg-white p-5 shadow-sm">
      <Link href={memberUrl} target="_blank" className="text-sm font-bold text-[#0f766e] underline">
        会員証を確認
      </Link>
      {Object.entries(initialValues).map(([name, value]) => (
        <label key={name} className="block">
          <span className="mb-1 block text-sm font-semibold">
            {{
              name: "店舗名",
              displayName: "会員証の表示名",
              logoUrl: "ロゴ画像URL",
              themeColor: "テーマカラー",
              liffId: "LIFF ID",
              lineAddFriendUrl: "LINE友だち追加URL",
              googleReviewUrl: "Google口コミURL",
            }[name]}
          </span>
          <input
            name={name}
            type={name === "themeColor" ? "color" : "text"}
            defaultValue={value}
            required={name === "name" || name === "displayName"}
            className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2"
          />
        </label>
      ))}
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">LINE Channel Access Token</span>
        <input
          name="lineChannelAccessToken"
          type="password"
          placeholder="変更する場合のみ入力"
          className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-[#0f766e] px-5 py-2 font-bold text-white disabled:bg-[#94a3b8]"
      >
        {isSubmitting ? "保存中..." : "保存"}
      </button>
      {message ? <p className="text-sm text-[#475569]">{message}</p> : null}
    </form>
  );
}
