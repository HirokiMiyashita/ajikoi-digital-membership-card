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
  latitude: string;
  longitude: string;
};

const themeColorPresets = [
  { color: "#0f766e", label: "ティール" },
  { color: "#2563eb", label: "ブルー" },
  { color: "#7c3aed", label: "パープル" },
  { color: "#db2777", label: "ピンク" },
  { color: "#dc2626", label: "レッド" },
  { color: "#ea580c", label: "オレンジ" },
];

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
  const [themeColor, setThemeColor] = useState(
    initialValues.themeColor || "#0f766e",
  );
  const [latitude, setLatitude] = useState(initialValues.latitude);
  const [longitude, setLongitude] = useState(initialValues.longitude);
  const [isLocating, setIsLocating] = useState(false);

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
  const previewThemeColor = /^#[0-9a-fA-F]{6}$/.test(themeColor)
    ? themeColor
    : "#0f766e";

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage("このブラウザでは位置情報を取得できません。");
      return;
    }
    setIsLocating(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(7));
        setLongitude(position.coords.longitude.toFixed(7));
        setIsLocating(false);
        setMessage("現在地を入力しました。内容を確認して保存してください。");
      },
      () => {
        setIsLocating(false);
        setMessage("位置情報を取得できませんでした。ブラウザの許可設定を確認してください。");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4 rounded-xl bg-white p-5 shadow-sm">
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
      <section className="space-y-3 rounded-xl border border-[#e2e8f0] p-4">
        <div>
          <h2 className="text-sm font-bold">チェックイン可能な店舗位置</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#64748b]">
            この位置から150m以内のユーザーだけが来店チェックインできます。店舗内で現在地を取得してください。
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            緯度
            <input
              name="latitude"
              type="number"
              min="-90"
              max="90"
              step="any"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-3 py-2 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            経度
            <input
              name="longitude"
              type="number"
              min="-180"
              max="180"
              step="any"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-3 py-2 font-normal"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={isLocating}
          className="rounded-lg border border-[#0f766e] px-4 py-2 text-sm font-bold text-[#0f766e] disabled:opacity-50"
        >
          {isLocating ? "現在地を取得中..." : "現在地を店舗位置に設定"}
        </button>
      </section>
      {Object.entries(initialValues).map(([name, value]) => {
        if (name === "latitude" || name === "longitude") return null;
        if (name === "themeColor") {
          return (
            <section key={name} className="space-y-3 rounded-xl border border-[#e2e8f0] p-4">
              <div>
                <h2 className="text-sm font-bold">会員証のメインカラー</h2>
                <p className="mt-1 text-xs leading-relaxed text-[#64748b]">
                  会員証上部、アンケートの進捗・選択状態・ボタンに反映されます。
                </p>
              </div>

              <div
                className="rounded-xl px-4 py-5 text-white shadow-sm transition-colors"
                style={{ backgroundColor: previewThemeColor }}
              >
                <p className="text-xs font-semibold text-white/75">MEMBERSHIP CARD</p>
                <p className="mt-4 text-lg font-bold">
                  {initialValues.displayName || initialValues.name || "店舗名"}
                </p>
                <p className="mt-1 text-xs text-white/80">会員証の表示イメージ</p>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-[#475569]">おすすめカラー</p>
                <div className="flex flex-wrap gap-2">
                  {themeColorPresets.map((preset) => {
                    const isSelected =
                      preset.color.toLowerCase() === previewThemeColor.toLowerCase();
                    return (
                      <button
                        key={preset.color}
                        type="button"
                        aria-label={`${preset.label}を選択`}
                        title={preset.label}
                        onClick={() => setThemeColor(preset.color)}
                        className={`size-9 rounded-full border-2 shadow-sm transition ${
                          isSelected
                            ? "scale-110 border-[#0f172a]"
                            : "border-white ring-1 ring-[#cbd5e1]"
                        }`}
                        style={{ backgroundColor: preset.color }}
                      >
                        <span className="sr-only">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-bold text-[#334155]">
                  <span
                    className="size-5 rounded-full border border-black/10"
                    style={{ backgroundColor: previewThemeColor }}
                    aria-hidden="true"
                  />
                  色を変更
                  <input
                    type="color"
                    value={previewThemeColor}
                    onChange={(event) => setThemeColor(event.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="カラーピッカーを開く"
                  />
                </label>
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#cbd5e1] bg-white px-3">
                  <span className="text-sm font-semibold text-[#64748b]">HEX</span>
                  <input
                    name="themeColor"
                    type="text"
                    value={themeColor}
                    onChange={(event) => setThemeColor(event.target.value)}
                    pattern="^#[0-9A-Fa-f]{6}$"
                    required
                    className="min-w-0 flex-1 py-2 text-sm font-semibold uppercase outline-none"
                    aria-label="テーマカラーのHEX値"
                  />
                </label>
              </div>
            </section>
          );
        }

        return (
          <label key={name} className="block">
            <span className="mb-1 block text-sm font-semibold">
              {{
                name: "店舗名",
                displayName: "会員証の表示名",
                logoUrl: "ロゴ画像URL",
                liffId: "LIFF ID",
                lineAddFriendUrl: "LINE友だち追加URL",
                googleReviewUrl: "Google口コミURL",
              }[name]}
            </span>
            <input
              name={name}
              type="text"
              defaultValue={value}
              required={name === "name" || name === "displayName"}
              className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2"
            />
          </label>
        );
      })}
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
