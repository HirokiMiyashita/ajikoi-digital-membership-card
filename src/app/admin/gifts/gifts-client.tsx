"use client";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ExpiryType = "DAYS_AFTER_ISSUE" | "FIXED_DATE";
type TemplateImage = {
  id: string;
  name: string;
  imagePath: string;
  displayUrl: string;
  sortOrder: number;
};
type ImageInputMode = "template" | "upload";

type GiftEditorInitialValue = {
  title: string;
  usageGuide: string;
  expiryType: ExpiryType;
  expiryDays: number | null;
  expiryAt: string | null;
  imagePath: string;
};

type GiftsClientProps = {
  mode: "create" | "edit";
  giftId?: string;
  initialValue?: GiftEditorInitialValue;
};

export default function GiftsClient({ mode, giftId, initialValue }: GiftsClientProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [usageGuide, setUsageGuide] = useState(initialValue?.usageGuide ?? "");
  const [expiryType, setExpiryType] = useState<ExpiryType>(initialValue?.expiryType ?? "DAYS_AFTER_ISSUE");
  const [expiryDays, setExpiryDays] = useState(String(initialValue?.expiryDays ?? 30));
  const [expiryAt, setExpiryAt] = useState(initialValue?.expiryAt ? initialValue.expiryAt.slice(0, 10) : "");
  const [imagePath, setImagePath] = useState(initialValue?.imagePath ?? "");
  const [imagePreviewUrl, setImagePreviewUrl] = useState(
    initialValue?.imagePath
      ? `/api/admin/blob?pathname=${encodeURIComponent(initialValue.imagePath)}`
      : "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [templates, setTemplates] = useState<TemplateImage[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [imageInputMode, setImageInputMode] = useState<ImageInputMode>("template");
  const [isTemplateSheetOpen, setIsTemplateSheetOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch("/api/admin/gifts/templates");
        const json = (await response.json()) as { ok: boolean; templates?: TemplateImage[] };
        if (!response.ok || !json.ok || !json.templates) return;
        setTemplates(json.templates);
      } catch {
        // ignore template fetch errors to keep form usable
      }
    };
    void fetchTemplates();
  }, []);

  const canSubmit = useMemo(() => {
    if (!title.trim() || !usageGuide.trim() || !imagePath.trim()) return false;
    if (expiryType === "DAYS_AFTER_ISSUE") {
      return Number.isInteger(Number(expiryDays)) && Number(expiryDays) > 0;
    }
    return Boolean(expiryAt);
  }, [title, usageGuide, imagePath, expiryType, expiryDays, expiryAt]);

  const effectiveSelectedTemplateId = useMemo(() => {
    if (selectedTemplateId) return selectedTemplateId;
    if (!imagePath) return null;
    return templates.find((template) => template.imagePath === imagePath)?.id ?? null;
  }, [selectedTemplateId, imagePath, templates]);

  const handleUploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage(null);
    setIsError(false);
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/gifts/upload", {
        method: "POST",
        body: formData,
      });
      const json = (await response.json()) as {
        ok: boolean;
        imagePath?: string;
        previewUrl?: string;
        message?: string;
      };
      if (!response.ok || !json.ok || !json.imagePath || !json.previewUrl) {
        setIsError(true);
        setMessage(json.message ?? "画像アップロードに失敗しました。");
        return;
      }
      setImagePath(json.imagePath);
      setImagePreviewUrl(json.previewUrl);
      setSelectedTemplateId(null);
      setMessage("画像をアップロードしました。");
    } catch {
      setIsError(true);
      setMessage("画像アップロード時に通信エラーが発生しました。");
    } finally {
      setIsUploadingImage(false);
      event.target.value = "";
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);
    try {
      const endpoint = mode === "edit" && giftId ? `/api/admin/gifts/${giftId}` : "/api/admin/gifts";
      const method = mode === "edit" ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          usageGuide,
          imagePath,
          expiryType,
          expiryDays: expiryType === "DAYS_AFTER_ISSUE" ? Number(expiryDays) : undefined,
          expiryAt: expiryType === "FIXED_DATE" ? expiryAt : undefined,
        }),
      });
      const json = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !json.ok) {
        setIsError(true);
        setMessage(json.message ?? "ギフト作成に失敗しました。");
        return;
      }

      if (mode === "edit") {
        setMessage("ギフトを更新しました。");
      } else {
        router.push("/admin/gifts");
        router.refresh();
      }
    } catch {
      setIsError(true);
      setMessage("通信エラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-4 p-4">
      <h1 className="text-xl font-bold">{mode === "edit" ? "ギフト編集" : "ギフト作成"}</h1>
      <section className="mx-auto w-[90%] rounded-xl border border-[#dbe2ea] bg-white p-4 shadow-sm">
        <h2 className="font-bold">{mode === "edit" ? "作成済みギフトを編集" : "新規ギフトを作成"}</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#334155]">特典名</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 outline-none focus:border-[#0f766e]"
              placeholder="例) お会計から5%引き"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#334155]">利用ガイド</span>
            <textarea
              value={usageGuide}
              onChange={(event) => setUsageGuide(event.target.value)}
              className="min-h-[120px] w-full rounded-lg border border-[#cbd5e1] px-3 py-2 outline-none focus:border-[#0f766e]"
              placeholder="利用時の注意事項を入力"
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-[#334155]">特典の有効期限</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="expiryType"
                checked={expiryType === "DAYS_AFTER_ISSUE"}
                onChange={() => setExpiryType("DAYS_AFTER_ISSUE")}
              />
              配布からの日数
            </label>
            {expiryType === "DAYS_AFTER_ISSUE" ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={expiryDays}
                  onChange={(event) => setExpiryDays(event.target.value)}
                  className="w-28 rounded-lg border border-[#cbd5e1] px-3 py-2 outline-none focus:border-[#0f766e]"
                />
                <span className="text-sm text-[#64748b]">日後まで</span>
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="expiryType"
                checked={expiryType === "FIXED_DATE"}
                onChange={() => setExpiryType("FIXED_DATE")}
              />
              特定の日付
            </label>
            {expiryType === "FIXED_DATE" ? (
              <input
                type="date"
                value={expiryAt}
                onChange={(event) => setExpiryAt(event.target.value)}
                className="w-52 rounded-lg border border-[#cbd5e1] px-3 py-2 outline-none focus:border-[#0f766e]"
              />
            ) : null}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-[#334155]">画像</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="imageInputMode"
                  checked={imageInputMode === "template"}
                  onChange={() => {
                    setImageInputMode("template");
                    setIsTemplateSheetOpen(true);
                  }}
                />
                テンプレートから選択
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="imageInputMode"
                  checked={imageInputMode === "upload"}
                  onChange={() => setImageInputMode("upload")}
                />
                自分の画像をアップロード
              </label>
            </div>

            {imageInputMode === "template" ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setIsTemplateSheetOpen(true)}
                  className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#334155] shadow-sm"
                >
                  テンプレートから選択
                </button>
                {templates.length === 0 ? (
                  <p className="text-sm text-[#64748b]">テンプレート画像が登録されていません。</p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-3">
                <label className="inline-flex cursor-pointer items-center rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#334155] shadow-sm">
                  写真を撮影・選択
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    capture="environment"
                    onChange={handleUploadImage}
                    className="hidden"
                  />
                </label>
                <p className="mt-2 text-xs text-[#64748b]">JPG / PNG / WEBP / GIF（15MBまで）</p>
              </div>
            )}

            {imagePath ? (
              <p className="break-all rounded-lg bg-[#f8fafc] px-3 py-2 text-xs text-[#334155]">
                選択中画像: {imagePath}
              </p>
            ) : null}
            {imagePreviewUrl ? (
              <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-lg border border-[#dbe2ea] bg-[#f8fafc]">
                <img src={imagePreviewUrl} alt="選択中画像" className="h-full w-full object-cover" />
              </div>
            ) : null}
          </fieldset>

          <button
            type="submit"
            disabled={!canSubmit || isSubmitting || isUploadingImage}
            className="rounded-lg bg-[#0f766e] px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
          >
            {isSubmitting
              ? mode === "edit"
                ? "更新中..."
                : "作成中..."
              : isUploadingImage
                ? "画像アップロード中..."
                : mode === "edit"
                  ? "ギフトを更新"
                  : "ギフトを作成"}
          </button>
        </form>

        {message ? (
          <p className={`mt-3 text-sm ${isError ? "text-[#b91c1c]" : "text-[#0f766e]"}`}>{message}</p>
        ) : null}
      </section>

      {isTemplateSheetOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            aria-label="テンプレート選択を閉じる"
            onClick={() => setIsTemplateSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
              <p className="text-sm font-bold text-[#0f172a]">画像をテンプレートから選択</p>
              <button
                type="button"
                className="text-xl leading-none text-[#64748b]"
                onClick={() => setIsTemplateSheetOpen(false)}
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
            <div className="grid max-h-[70vh] grid-cols-2 gap-0 overflow-y-auto sm:grid-cols-3">
              {templates.map((template) => {
                const selected = effectiveSelectedTemplateId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(template.id);
                      setImagePath(template.imagePath);
                      setImagePreviewUrl(template.displayUrl);
                      setIsTemplateSheetOpen(false);
                    }}
                    className={`relative aspect-video overflow-hidden ${
                      selected ? "ring-4 ring-inset ring-[#14b8a6]" : ""
                    }`}
                  >
                    <img src={template.displayUrl} alt={template.name} className="h-full w-full object-cover" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
