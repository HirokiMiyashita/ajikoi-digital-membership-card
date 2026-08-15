"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

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
  liffEndpointUrl,
  richMenuUrl,
}: {
  initialValues: StoreSettings;
  liffEndpointUrl: string;
  richMenuUrl: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const copyValue = async (label: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(label);
      window.setTimeout(() => setCopiedValue(null), 2000);
    } catch {
      setMessage("コピーに失敗しました。URLを選択してコピーしてください。");
    }
  };

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
    if (response.ok) {
      router.refresh();
    }
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4 rounded-xl bg-white p-5 shadow-sm">
      <section className="space-y-3 rounded-xl border border-[#ccfbf1] bg-[#f0fdfa] p-4">
        <div>
          <h2 className="text-sm font-bold text-[#115e59]">LINE側に登録するURL</h2>
          <p className="mt-1 text-xs text-[#475569]">
            以下の値をコピーしてLINE Developersとリッチメニューに設定してください。
          </p>
        </div>
        {[
          {
            label: "LIFF Endpoint URL",
            description: "LINE DevelopersのLIFFアプリに設定",
            value: liffEndpointUrl,
          },
          {
            label: "リッチメニュー登録URL",
            description: "LINE Official Account Managerのリッチメニューに設定",
            value: richMenuUrl,
          },
        ].map((item) => (
          <label key={item.label} className="block">
            <span className="mb-1 block text-sm font-semibold">{item.label}</span>
            <span className="mb-1 block text-xs text-[#64748b]">{item.description}</span>
            <span className="flex gap-2">
              <input
                type="text"
                value={item.value}
                readOnly
                placeholder={item.label === "リッチメニュー登録URL" ? "LIFF IDを保存すると表示されます" : undefined}
                className="min-w-0 flex-1 rounded-lg border border-[#99f6e4] bg-white px-3 py-2 text-sm text-[#334155]"
              />
              <button
                type="button"
                disabled={!item.value}
                onClick={() => copyValue(item.label, item.value)}
                className="shrink-0 rounded-lg border border-[#0f766e] px-3 py-2 text-sm font-bold text-[#0f766e] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copiedValue === item.label ? "コピー済み" : "コピー"}
              </button>
            </span>
          </label>
        ))}
      </section>
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
