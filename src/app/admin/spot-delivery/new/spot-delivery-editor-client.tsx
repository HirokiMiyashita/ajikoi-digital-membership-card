"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type UserOption = {
  userId: string;
  displayName: string;
};

type GiftOption = {
  id: string;
  title: string;
  imageUrl: string;
  usageGuide: string;
  previewImageUrl: string;
  lineImageUrl: string | null;
};

type Props = {
  users: UserOption[];
  gifts: GiftOption[];
  targetCount: number;
};

type LineTextMessage = {
  type: "text";
  text: string;
};

type LineImageMessage = {
  type: "image";
  originalContentUrl: string;
  previewImageUrl: string;
};

type LineFlexMessage = {
  type: "flex";
  altText: string;
  contents: Record<string, unknown>;
};

type LineMessage = LineTextMessage | LineImageMessage | LineFlexMessage;

export default function SpotDeliveryEditorClient({ users, gifts, targetCount }: Props) {
  const [title, setTitle] = useState("");
  const [notificationText, setNotificationText] = useState("");
  const [message, setMessage] = useState("");
  const [showTextElement, setShowTextElement] = useState(false);
  const [showImageElement, setShowImageElement] = useState(false);
  const [showGiftElement, setShowGiftElement] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftOption | null>(null);
  const [isGiftSheetOpen, setIsGiftSheetOpen] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [targetMode, setTargetMode] = useState<"all" | "selected">("all");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const canSubmit = useMemo(() => {
    const hasContent = showTextElement || showImageElement || showGiftElement;
    if (!hasContent) return false;
    if (showTextElement && message.trim().length === 0) return false;
    if (showImageElement && !selectedImageFile && !uploadedImageUrl) return false;
    if (showGiftElement && !selectedGift) return false;
    if (targetMode === "selected") return selectedUserIds.length > 0;
    return true;
  }, [
    message,
    selectedGift,
    selectedImageFile,
    selectedUserIds,
    showGiftElement,
    showImageElement,
    showTextElement,
    targetMode,
    uploadedImageUrl,
  ]);

  const toggleSelectedUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const showToast = (text: string, error = false) => {
    setToast(text);
    setIsError(error);
    setTimeout(() => setToast(null), 2400);
  };

  const handleSaveDraft = () => {
    showToast("下書きを保存しました。");
  };

  useEffect(() => {
    if (!selectedImageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedImageFile);
    setImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedImageFile]);

  const openImagePicker = () => {
    setShowImageElement(true);
    imageInputRef.current?.click();
  };
  const openGiftSheet = () => {
    setShowGiftElement(true);
    setIsGiftSheetOpen(true);
  };

  const handleImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    setSelectedImageFile(file);
    setUploadedImageUrl(null);
  };

  const uploadSelectedImageIfNeeded = async () => {
    if (!showImageElement) return uploadedImageUrl;
    if (!selectedImageFile) return uploadedImageUrl;
    if (uploadedImageUrl) return uploadedImageUrl;

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedImageFile);
      const response = await fetch("/api/admin/gifts/upload", {
        method: "POST",
        body: formData,
      });
      const json = (await response.json()) as { ok: boolean; imagePath?: string; message?: string };
      if (!response.ok || !json.ok || !json.imagePath) {
        throw new Error(json.message ?? "画像アップロードに失敗しました。");
      }
      setUploadedImageUrl(json.imagePath);
      return json.imagePath;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const buildLineMessages = (imageUrl: string | null): LineMessage[] => {
    const lineMessages: LineMessage[] = [];
    if (showTextElement && message.trim()) {
      lineMessages.push({
        type: "text",
        text: message.trim(),
      });
    }
    if (showImageElement && imageUrl) {
      lineMessages.push({
        type: "image",
        originalContentUrl: imageUrl,
        previewImageUrl: imageUrl,
      });
    }
    if (showGiftElement && selectedGift) {
      if (!selectedGift.lineImageUrl) {
        throw new Error("選択したギフト画像はLINEから参照できません。ギフト画像を再保存してください。");
      }
      const buttonUrl =
        typeof window !== "undefined" ? `${window.location.origin}/benefits` : "https://example.com/benefits";
      lineMessages.push({
        type: "flex",
        altText: selectedGift.title,
        contents: {
          type: "bubble",
          hero: {
            type: "image",
            url: selectedGift.lineImageUrl,
            size: "full",
            aspectRatio: "4:3",
            aspectMode: "cover",
          },
          body: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: selectedGift.title,
                weight: "bold",
                size: "xl",
                wrap: true,
              },
              {
                type: "text",
                text: selectedGift.usageGuide?.trim() || "タップして獲得してください",
                size: "sm",
                color: "#6b7280",
                wrap: true,
              },
            ],
          },
          footer: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#0f9f99",
                action: {
                  type: "uri",
                  label: "このギフトを獲得する",
                  uri: buttonUrl,
                },
              },
            ],
          },
        },
      });
    }
    return lineMessages;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const imageUrl = await uploadSelectedImageIfNeeded();
      const lineMessages = buildLineMessages(imageUrl ?? null);
      if (lineMessages.length === 0) {
        showToast("配信メッセージを1つ以上追加してください。", true);
        return;
      }
      const response = await fetch("/api/admin/spot-delivery/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          notificationText: notificationText.trim(),
          messages: lineMessages,
          targetMode,
          userIds: targetMode === "selected" ? selectedUserIds : [],
        }),
      });
      const json = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !json.ok) {
        showToast(json.message ?? "配信に失敗しました。", true);
        return;
      }
      showToast("配信ジョブを開始しました。");
      setTitle("");
      setNotificationText("");
      setMessage("");
      setShowTextElement(false);
      setShowImageElement(false);
      setShowGiftElement(false);
      setSelectedGift(null);
      setSelectedImageFile(null);
      setUploadedImageUrl(null);
      setSelectedUserIds([]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "通信エラーが発生しました。", true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewText = message.trim() || "Hello, world";

  return (
    <div className="w-full p-4">
      <form onSubmit={handleSubmit} className="mx-auto w-[95%] overflow-hidden rounded-xl border border-[#dbe2ea] bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/admin/spot-delivery" className="text-xl leading-none text-[#334155]">
              ←
            </Link>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="タイトル未設定"
              className="w-52 rounded border border-transparent px-2 py-1 text-base font-bold outline-none focus:border-[#cbd5e1]"
            />
          </div>
          <div className="flex items-center gap-2">
            <p className="hidden text-xs text-[#64748b] md:block">配信対象 {targetCount}人</p>
            <button
              type="button"
              onClick={handleSaveDraft}
              className="rounded-lg border border-[#cbd5e1] px-3 py-1.5 text-sm font-semibold text-[#334155]"
            >
              下書き保存
            </button>
            <button
              type="submit"
              disabled={!canSubmit || isSubmitting || isUploadingImage}
              className="rounded-lg bg-[#0f766e] px-3 py-1.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
            >
              {isUploadingImage ? "画像アップロード中..." : isSubmitting ? "配信中..." : "配信する"}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px]">
          <div className="border-r border-[#e2e8f0] p-4">
            <div className="mb-4 flex gap-4 border-b border-[#e2e8f0] text-sm font-semibold">
              <span className="border-b-2 border-[#0f766e] pb-2 text-[#0f172a]">配信内容</span>
              <span className="pb-2 text-[#94a3b8]">セグメント</span>
            </div>

            <section className="space-y-3 rounded-lg border border-[#e2e8f0] p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#334155]">通知テキスト</p>
                <button type="button" className="rounded border border-[#cbd5e1] px-3 py-1 text-xs">
                  設定
                </button>
              </div>
              <input
                value={notificationText}
                onChange={(event) => setNotificationText(event.target.value)}
                placeholder="ロック画面用のテキスト"
                className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-[#0f766e]"
              />
            </section>

            {showTextElement ? (
              <section className="mt-3 rounded-lg border border-[#e2e8f0] p-3">
                <p className="text-sm font-semibold text-[#334155]">本文テキスト</p>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="配信本文を入力してください"
                  className="mt-2 min-h-[120px] w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-[#0f766e]"
                />
              </section>
            ) : null}

            {showImageElement ? (
              <section className="mt-3 rounded-lg border border-[#e2e8f0] p-3">
                <p className="text-sm font-semibold text-[#334155]">画像</p>
                <p className="mt-1 text-sm text-[#64748b]">画像を選択できます</p>
                <div className="mt-3 rounded-lg border border-[#e2e8f0] bg-[#fafafa] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-14 w-14 overflow-hidden rounded border border-[#dbe2ea] bg-white">
                        {imagePreviewUrl ? (
                          <img src={imagePreviewUrl} alt="選択画像プレビュー" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-[#94a3b8]">画像</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-[#64748b]">画像</p>
                        <p className="truncate text-lg font-semibold text-[#0f172a]">
                          {selectedImageFile?.name ?? "未設定"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={openImagePicker}
                      disabled={isUploadingImage}
                      className="rounded-lg border border-[#cbd5e1] px-4 py-2 text-sm font-semibold text-[#334155]"
                    >
                      {isUploadingImage ? "アップロード中..." : "変更"}
                    </button>
                  </div>
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFileChange}
                />
              </section>
            ) : null}

            {showGiftElement ? (
              <section className="mt-3 rounded-lg border border-[#e2e8f0] p-3">
                <p className="text-sm font-semibold text-[#334155]">ギフト</p>
                <p className="mt-1 text-sm text-[#64748b]">配信に使用するギフトを設定できます</p>
                <div className="mt-3 rounded-lg border border-[#e2e8f0] bg-[#fafafa] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-14 w-14 overflow-hidden rounded border border-[#dbe2ea] bg-white">
                        {selectedGift ? (
                          <img src={selectedGift.previewImageUrl} alt={selectedGift.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-[#94a3b8]">🎁</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-[#64748b]">ギフト</p>
                        <p className="truncate text-lg font-semibold text-[#0f172a]">
                          {selectedGift?.title ?? "未設定"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={openGiftSheet}
                      className="rounded-lg border border-[#cbd5e1] px-4 py-2 text-sm font-semibold text-[#334155]"
                    >
                      変更
                    </button>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="mt-3 rounded-lg border border-[#e2e8f0] p-3">
              <p className="text-sm font-semibold text-[#334155]">追加する要素</p>
              <div className="mt-3 grid grid-cols-5 gap-2 text-center text-xs text-[#334155]">
                <button
                  type="button"
                  onClick={() => setShowTextElement(true)}
                  className={`rounded border px-2 py-3 ${
                    showTextElement
                      ? "border-[#0f766e] bg-[#ecfeff] font-semibold text-[#0f766e]"
                      : "border-[#dbe2ea] bg-[#f8fafc]"
                  }`}
                >
                  テキスト
                </button>
                <button
                  type="button"
                  onClick={openImagePicker}
                  className={`rounded border px-2 py-3 ${
                    showImageElement
                      ? "border-[#0f766e] bg-[#ecfeff] font-semibold text-[#0f766e]"
                      : "border-[#dbe2ea] bg-[#f8fafc]"
                  }`}
                >
                  画像
                </button>
                <button
                  type="button"
                  onClick={openGiftSheet}
                  className={`rounded border px-2 py-3 ${
                    showGiftElement
                      ? "border-[#0f766e] bg-[#ecfeff] font-semibold text-[#0f766e]"
                      : "border-[#dbe2ea] bg-[#f8fafc]"
                  }`}
                >
                  ギフト
                </button>
                {["アンケート", "カード"].map((label) => (
                  <div key={label} className="rounded border border-[#dbe2ea] bg-[#f8fafc] px-2 py-3">
                    {label}
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-3 rounded-lg border border-[#e2e8f0] p-3">
              <p className="text-sm font-semibold text-[#334155]">配信対象</p>
              <div className="mt-2 flex items-center gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="targetMode"
                    checked={targetMode === "all"}
                    onChange={() => setTargetMode("all")}
                  />
                  すべての会員
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="targetMode"
                    checked={targetMode === "selected"}
                    onChange={() => setTargetMode("selected")}
                  />
                  対象会員を選択
                </label>
              </div>
              {targetMode === "selected" ? (
                <div className="mt-3 max-h-44 space-y-2 overflow-y-auto rounded border border-[#dbe2ea] p-2">
                  {users.map((user) => (
                    <label key={user.userId} className="flex items-center gap-2 text-sm text-[#334155]">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.userId)}
                        onChange={() => toggleSelectedUser(user.userId)}
                      />
                      <span className="truncate">
                        {user.displayName} ({user.userId})
                      </span>
                    </label>
                  ))}
                </div>
              ) : null}
            </section>
          </div>

          <aside className="bg-[#9db8de] p-4">
            <div className="mx-auto w-full max-w-[320px] rounded-2xl bg-[#84a5d3] p-3 shadow-inner">
              <div className="mb-3 h-10 w-10 rounded-full bg-[#6d8fbe]" />

              {showTextElement ? (
                <div className="mb-3 w-fit max-w-[92%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">
                  <p className="whitespace-pre-wrap text-[15px] text-[#0f172a]">{previewText}</p>
                  <p className="mt-2 text-[11px] font-semibold text-[#94a3b8]">type: text</p>
                </div>
              ) : null}

              {showImageElement ? (
                <div className="mb-3 w-[92%] overflow-hidden rounded-2xl bg-white shadow-sm">
                  {imagePreviewUrl ? (
                    <img src={imagePreviewUrl} alt="LINE画像メッセージプレビュー" className="h-44 w-full object-cover" />
                  ) : (
                    <div className="flex h-44 items-center justify-center text-xs text-[#94a3b8]">画像未設定</div>
                  )}
                  <div className="px-3 py-2">
                    <p className="text-[11px] font-semibold text-[#94a3b8]">type: image</p>
                  </div>
                </div>
              ) : null}

              {showGiftElement ? (
                <div className="mb-3 w-[92%] overflow-hidden rounded-2xl bg-white shadow-sm">
                  <div className="h-52 w-full overflow-hidden bg-[#d1fae5]">
                    {selectedGift ? (
                        <img src={selectedGift.previewImageUrl} alt={selectedGift.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-[#94a3b8]">ギフト画像未設定</div>
                    )}
                  </div>
                  <div className="space-y-2 p-4">
                    <p className="text-3xl font-bold leading-tight text-[#111827]">
                      {selectedGift?.title ?? "ギフト未設定"}
                    </p>
                    <p className="text-sm text-[#6b7280]">
                      {selectedGift?.usageGuide?.trim() || "タップして獲得してください"}
                    </p>
                    <button
                      type="button"
                      className="w-full rounded-lg bg-[#0f9f99] px-3 py-3 text-base font-bold text-white"
                    >
                      このギフトを獲得する
                    </button>
                    <p className="text-[11px] font-semibold text-[#94a3b8]">type: flex</p>
                  </div>
                </div>
              ) : null}

              <div className="text-right text-xs text-[#5f7fa8]">07:19</div>
            </div>
          </aside>
        </div>
      </form>

      {toast ? (
        <p
          className={`mx-auto mt-3 w-fit rounded-full px-4 py-2 text-sm font-semibold text-white ${
            isError ? "bg-[#dc2626]" : "bg-[#0f766e]"
          }`}
        >
          {toast}
        </p>
      ) : null}
      {isGiftSheetOpen ? (
        <div className="fixed inset-0 z-50 bg-black/30">
          <button
            type="button"
            aria-label="close gift sheet"
            className="absolute inset-0"
            onClick={() => setIsGiftSheetOpen(false)}
          />
          <section className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 shadow-2xl">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[#cbd5e1]" />
            <p className="text-base font-bold text-[#0f172a]">ギフトを選択</p>
            <div className="mt-3 max-h-[55vh] space-y-2 overflow-y-auto pb-4">
              {gifts.length === 0 ? (
                <p className="rounded-lg border border-[#e2e8f0] px-3 py-4 text-sm text-[#64748b]">
                  利用可能なギフトがありません。
                </p>
              ) : (
                gifts.map((gift) => (
                  <button
                    key={gift.id}
                    type="button"
                    onClick={() => {
                      setSelectedGift(gift);
                      setShowGiftElement(true);
                      setIsGiftSheetOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left ${
                      selectedGift?.id === gift.id
                        ? "border-[#0f766e] bg-[#ecfeff]"
                        : "border-[#e2e8f0] bg-white"
                    }`}
                  >
                    <div className="h-12 w-12 overflow-hidden rounded border border-[#dbe2ea] bg-white">
                      <img src={gift.previewImageUrl} alt={gift.title} className="h-full w-full object-cover" />
                    </div>
                    <p className="line-clamp-2 text-sm font-semibold text-[#0f172a]">{gift.title}</p>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
