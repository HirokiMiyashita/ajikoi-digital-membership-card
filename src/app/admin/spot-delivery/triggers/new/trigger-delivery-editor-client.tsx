"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type TriggerType = "USER_SIGNUP" | "CHECKIN_POINT_GRANTED" | "RANK_UP" | "BIRTHDAY" | "GIFT_EXPIRES";
type DeliveryVisitCountSegment = "ZERO" | "ONE" | "TWO_TO_FOUR" | "FIVE_TO_NINE" | "TEN_OR_MORE";
type LineTextMessage = { type: "text"; text: string };
type LineImageMessage = { type: "image"; originalContentUrl: string; previewImageUrl: string };
type LineFlexMessage = { type: "flex"; altText: string; contents: Record<string, unknown> };
type LineMessage = LineTextMessage | LineImageMessage | LineFlexMessage;
type TextEditorMessage = { id: string; type: "text"; text: string };
type ImageEditorMessage = {
  id: string;
  type: "image";
  file: File | null;
  uploadedUrl: string | null;
  previewUrl: string | null;
};
type GiftEditorMessage = {
  id: string;
  type: "gift";
  gift: GiftOption | null;
  existingMessage: LineFlexMessage | null;
  altText: string;
};
type EditorMessage = TextEditorMessage | ImageEditorMessage | GiftEditorMessage;

const MAX_MESSAGE_COUNT = 5;

type GiftOption = {
  id: string;
  title: string;
  imageUrl: string;
  usageGuide: string;
  previewImageUrl: string;
  lineImageUrl: string | null;
};

type Props = {
  gifts: GiftOption[];
  rankOptions: Array<{ id: string; name: string }>;
  mode?: "create" | "edit";
  triggerId?: string;
  initialValue?: {
    title: string;
    triggerType: TriggerType;
    notificationText?: string;
    messages?: unknown;
    message: string;
    targetRankIds?: string[];
    targetGender?: "male" | "female" | "other" | null;
    targetVisitCountSegments?: DeliveryVisitCountSegment[];
    delayDays?: number;
    deliveryHourJst?: number | null;
    isActive: boolean;
  };
};

function parseInitialMessages(rawMessages: unknown, fallbackMessage: string): LineMessage[] {
  if (!Array.isArray(rawMessages)) {
    return fallbackMessage.trim() ? [{ type: "text", text: fallbackMessage.trim() }] : [];
  }
  const parsed: LineMessage[] = [];
  for (const item of rawMessages) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.type === "text" && typeof row.text === "string" && row.text.trim()) {
      parsed.push({ type: "text", text: row.text });
      continue;
    }
    if (
      row.type === "image" &&
      typeof row.originalContentUrl === "string" &&
      typeof row.previewImageUrl === "string"
    ) {
      parsed.push({
        type: "image",
        originalContentUrl: row.originalContentUrl,
        previewImageUrl: row.previewImageUrl,
      });
      continue;
    }
    if (row.type === "flex" && typeof row.altText === "string" && row.contents && typeof row.contents === "object") {
      parsed.push({
        type: "flex",
        altText: row.altText,
        contents: row.contents as Record<string, unknown>,
      });
    }
  }
  return parsed;
}

function getFlexHeroUrl(message: LineFlexMessage): string | null {
  const hero = message.contents.hero;
  if (!hero || typeof hero !== "object") return null;
  const url = (hero as { url?: unknown }).url;
  return typeof url === "string" ? url : null;
}

function getFlexTitle(message: LineFlexMessage): string {
  const body = message.contents.body;
  if (!body || typeof body !== "object") return message.altText;
  const contents = (body as { contents?: unknown }).contents;
  if (!Array.isArray(contents)) return message.altText;
  const title = contents.find(
    (item) =>
      item &&
      typeof item === "object" &&
      (item as { type?: unknown }).type === "text" &&
      typeof (item as { text?: unknown }).text === "string",
  ) as { text?: string } | undefined;
  return title?.text ?? message.altText;
}

function createInitialEditorMessages(messages: LineMessage[], gifts: GiftOption[]): EditorMessage[] {
  return messages.map((message, index) => {
    const id = `initial-message-${index}`;
    if (message.type === "text") {
      return { id, type: "text", text: message.text };
    }
    if (message.type === "image") {
      return {
        id,
        type: "image",
        file: null,
        uploadedUrl: message.originalContentUrl,
        previewUrl: message.previewImageUrl,
      };
    }
    const heroUrl = getFlexHeroUrl(message);
    return {
      id,
      type: "gift",
      gift: heroUrl ? gifts.find((gift) => gift.lineImageUrl === heroUrl) ?? null : null,
      existingMessage: message,
      altText: message.altText,
    };
  });
}

export default function TriggerDeliveryEditorClient({
  gifts,
  rankOptions,
  mode = "create",
  triggerId,
  initialValue,
}: Props) {
  const initialMessages = useMemo(
    () => parseInitialMessages(initialValue?.messages, initialValue?.message ?? ""),
    [initialValue?.message, initialValue?.messages],
  );
  const initialEditorMessages = useMemo(
    () => createInitialEditorMessages(initialMessages, gifts),
    [gifts, initialMessages],
  );

  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [activeTab, setActiveTab] = useState<"content" | "segment">("content");
  const [triggerType, setTriggerType] = useState<TriggerType>(initialValue?.triggerType ?? "USER_SIGNUP");
  const [editorMessages, setEditorMessages] = useState<EditorMessage[]>(initialEditorMessages);
  const [draggedMessageId, setDraggedMessageId] = useState<string | null>(null);
  const [dragOverMessageId, setDragOverMessageId] = useState<string | null>(null);
  const [giftSheetMessageId, setGiftSheetMessageId] = useState<string | null>(null);
  const [targetRankIds, setTargetRankIds] = useState<string[]>(initialValue?.targetRankIds ?? []);
  const [targetGender, setTargetGender] = useState<"male" | "female" | "other" | null>(initialValue?.targetGender ?? null);
  const [targetVisitCountSegments, setTargetVisitCountSegments] = useState<DeliveryVisitCountSegment[]>(
    initialValue?.targetVisitCountSegments ?? [],
  );
  const [delayDays, setDelayDays] = useState<number>(initialValue?.delayDays ?? 0);
  const [deliveryHourJst, setDeliveryHourJst] = useState<number | null>(initialValue?.deliveryHourJst ?? null);
  const [isActive, setIsActive] = useState(initialValue?.isActive ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const nextMessageIdRef = useRef(0);
  const imageInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const objectUrlsRef = useRef<Set<string>>(new Set());

  const canSubmit = useMemo(() => {
    if (editorMessages.length === 0 || editorMessages.length > MAX_MESSAGE_COUNT) return false;
    const hasInvalidMessage = editorMessages.some((item) => {
      if (item.type === "text") return item.text.trim().length === 0;
      if (item.type === "image") return !item.file && !item.uploadedUrl;
      return !item.gift && !item.existingMessage;
    });
    if (hasInvalidMessage) return false;
    return title.trim().length > 0 && !isSaving;
  }, [editorMessages, isSaving, title]);

  const showToast = (text: string, error = false) => {
    setToast(text);
    setIsError(error);
    setTimeout(() => setToast(null), 2400);
  };

  const handleSaveDraft = () => {
    showToast("下書きを保存しました。");
  };

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;
    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
    };
  }, []);
  const createMessageId = () => {
    const id = `new-message-${nextMessageIdRef.current}`;
    nextMessageIdRef.current += 1;
    return id;
  };

  const addTextMessage = () => {
    if (editorMessages.length >= MAX_MESSAGE_COUNT) return;
    const id = createMessageId();
    setEditorMessages((prev) =>
      prev.length >= MAX_MESSAGE_COUNT ? prev : [...prev, { id, type: "text", text: "" }],
    );
  };

  const addImageMessage = () => {
    if (editorMessages.length >= MAX_MESSAGE_COUNT) return;
    const id = createMessageId();
    setEditorMessages((prev) =>
      prev.length >= MAX_MESSAGE_COUNT
        ? prev
        : [...prev, { id, type: "image", file: null, uploadedUrl: null, previewUrl: null }],
    );
    setTimeout(() => imageInputRefs.current[id]?.click(), 0);
  };

  const addGiftMessage = () => {
    if (editorMessages.length >= MAX_MESSAGE_COUNT) return;
    const id = createMessageId();
    setEditorMessages((prev) =>
      prev.length >= MAX_MESSAGE_COUNT
        ? prev
        : [...prev, { id, type: "gift", gift: null, existingMessage: null, altText: "" }],
    );
    setGiftSheetMessageId(id);
  };

  const removeMessage = (id: string) => {
    const target = editorMessages.find((item) => item.id === id);
    if (target?.type === "image" && target.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(target.previewUrl);
      objectUrlsRef.current.delete(target.previewUrl);
    }
    delete imageInputRefs.current[id];
    setEditorMessages((prev) => prev.filter((item) => item.id !== id));
    setGiftSheetMessageId((current) => (current === id ? null : current));
  };

  const moveMessage = (sourceId: string, destinationId: string) => {
    if (sourceId === destinationId) return;
    setEditorMessages((prev) => {
      const sourceIndex = prev.findIndex((item) => item.id === sourceId);
      const destinationIndex = prev.findIndex((item) => item.id === destinationId);
      if (sourceIndex < 0 || destinationIndex < 0) return prev;
      const reordered = [...prev];
      const [moved] = reordered.splice(sourceIndex, 1);
      if (!moved) return prev;
      reordered.splice(destinationIndex, 0, moved);
      return reordered;
    });
  };

  const handleDragStart = (event: DragEvent<HTMLElement>, messageId: string) => {
    setDraggedMessageId(messageId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", messageId);
  };

  const finishDragging = () => {
    setDraggedMessageId(null);
    setDragOverMessageId(null);
  };

  const handleImageFileChange = (id: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    objectUrlsRef.current.add(previewUrl);
    const currentMessage = editorMessages.find((item) => item.id === id);
    if (currentMessage?.type === "image" && currentMessage.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(currentMessage.previewUrl);
      objectUrlsRef.current.delete(currentMessage.previewUrl);
    }
    setEditorMessages((prev) =>
      prev.map((item) => {
        if (item.id !== id || item.type !== "image") return item;
        return { ...item, file, uploadedUrl: null, previewUrl };
      }),
    );
    event.target.value = "";
  };

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/admin/gifts/upload", {
      method: "POST",
      body: formData,
    });
    const json = (await response.json()) as { ok: boolean; imagePath?: string; message?: string };
    if (!response.ok || !json.ok || !json.imagePath) {
      throw new Error(json.message ?? "画像アップロードに失敗しました。");
    }
    return json.imagePath;
  };

  const buildGiftMessage = (item: GiftEditorMessage): LineFlexMessage => {
    if (item.existingMessage) {
      return {
        ...item.existingMessage,
        altText:
          item.altText.trim() ||
          item.existingMessage.altText ||
          item.gift?.title ||
          getFlexTitle(item.existingMessage),
      };
    }
    if (!item.gift) {
      throw new Error("ギフトを選択してください。");
    }
    if (!item.gift.lineImageUrl) {
      throw new Error("選択したギフト画像はLINEから参照できません。ギフト画像を再保存してください。");
    }
    if (/\.svg(\?|$)/i.test(item.gift.lineImageUrl)) {
      throw new Error("テンプレートSVG画像はLINE Flexで表示できません。PNG/JPEG画像のギフトを選択してください。");
    }
    const buttonUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/?giftId=${encodeURIComponent(item.gift.id)}`
        : `https://example.com/?giftId=${encodeURIComponent(item.gift.id)}`;
    return {
      type: "flex",
      altText: item.altText.trim() || item.gift.title,
      contents: {
        type: "bubble",
        hero: {
          type: "image",
          url: item.gift.lineImageUrl,
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
              text: item.gift.title,
              weight: "bold",
              size: "xl",
              wrap: true,
            },
            {
              type: "text",
              text: item.gift.usageGuide?.trim() || "タップして獲得してください",
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
    };
  };

  const buildLineMessages = async (): Promise<LineMessage[]> => {
    setIsUploadingImage(true);
    try {
      const lineMessages: LineMessage[] = [];
      const uploadedUrls = new Map<string, string>();
      for (const item of editorMessages) {
        if (item.type === "text") {
          lineMessages.push({ type: "text", text: item.text.trim() });
          continue;
        }
        if (item.type === "image") {
          const imageUrl = item.file ? await uploadImage(item.file) : item.uploadedUrl;
          if (!imageUrl) throw new Error("画像を選択してください。");
          uploadedUrls.set(item.id, imageUrl);
          lineMessages.push({ type: "image", originalContentUrl: imageUrl, previewImageUrl: imageUrl });
          continue;
        }
        lineMessages.push(buildGiftMessage(item));
      }
      if (uploadedUrls.size > 0) {
        setEditorMessages((prev) =>
          prev.map((item) =>
            item.type === "image" && uploadedUrls.has(item.id)
              ? { ...item, file: null, uploadedUrl: uploadedUrls.get(item.id) ?? item.uploadedUrl }
              : item,
          ),
        );
      }
      return lineMessages;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const triggerTypeLabel: Record<TriggerType, string> = {
    USER_SIGNUP: "会員登録時",
    CHECKIN_POINT_GRANTED: "来店ポイント付与時",
    RANK_UP: "ランクアップ時",
    BIRTHDAY: "誕生日",
    GIFT_EXPIRES: "ギフト期限切れ",
  };
  const canUseNegativeDelay = triggerType === "BIRTHDAY" || triggerType === "GIFT_EXPIRES";
  const genderOptions: Array<{ value: "male" | "female" | "other"; label: string }> = [
    { value: "male", label: "男性" },
    { value: "female", label: "女性" },
    { value: "other", label: "その他" },
  ];
  const visitCountSegmentOptions: Array<{ value: DeliveryVisitCountSegment; label: string }> = [
    { value: "ZERO", label: "0回" },
    { value: "ONE", label: "1回" },
    { value: "TWO_TO_FOUR", label: "2〜4回" },
    { value: "FIVE_TO_NINE", label: "5〜9回" },
    { value: "TEN_OR_MORE", label: "10回以上" },
  ];

  const toggleRankTarget = (rankId: string) => {
    setTargetRankIds((prev) =>
      prev.includes(rankId) ? prev.filter((id) => id !== rankId) : [...prev, rankId],
    );
  };
  const toggleVisitCountTarget = (segment: DeliveryVisitCountSegment) => {
    setTargetVisitCountSegments((prev) =>
      prev.includes(segment) ? prev.filter((value) => value !== segment) : [...prev, segment],
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isSaving) return;

    setIsSaving(true);
    try {
      const lineMessages = await buildLineMessages();
      if (lineMessages.length === 0) {
        showToast("配信メッセージを1つ以上追加してください。", true);
        return;
      }

      const endpoint =
        mode === "edit" && triggerId
          ? `/api/admin/spot-delivery/triggers/${encodeURIComponent(triggerId)}`
          : "/api/admin/spot-delivery/triggers";
      const response = await fetch(endpoint, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          triggerType,
          notificationText:
            lineMessages.find((message): message is LineFlexMessage => message.type === "flex")
              ?.altText ?? "",
          messages: lineMessages,
          targetRankIds,
          targetGender,
          targetVisitCountSegments,
          delayDays,
          deliveryHourJst,
          isActive,
        }),
      });
      const json = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.message ?? "トリガー配信の保存に失敗しました。");
      }
      showToast(mode === "edit" ? "トリガー配信を更新しました。" : "トリガー配信を保存しました。");
      setTimeout(() => {
        window.location.href = "/admin/spot-delivery";
      }, 700);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "トリガー配信の保存に失敗しました。", true);
    } finally {
      setIsSaving(false);
    }
  };

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
              placeholder="管理用タイトル"
              aria-label="管理用タイトル（配信履歴と設定一覧に表示）"
              className="w-56 rounded border border-transparent px-2 py-1 text-base font-bold outline-none focus:border-[#cbd5e1]"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="rounded-lg border border-[#cbd5e1] px-3 py-1.5 text-sm font-semibold text-[#334155]"
            >
              下書き保存
            </button>
            <button
              type="submit"
              disabled={!canSubmit || isUploadingImage}
              className="rounded-lg bg-[#0f766e] px-3 py-1.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
            >
              {isUploadingImage ? "画像アップロード中..." : isSaving ? "保存中..." : mode === "edit" ? "更新する" : "保存する"}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px]">
          <div className="border-r border-[#e2e8f0] p-4">
            <div className="mb-4 flex gap-4 border-b border-[#e2e8f0] text-sm font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("content")}
                className={`border-b-2 pb-2 ${
                  activeTab === "content"
                    ? "border-[#0f766e] text-[#0f172a]"
                    : "border-transparent text-[#94a3b8]"
                }`}
              >
                配信内容
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("segment")}
                className={`border-b-2 pb-2 ${
                  activeTab === "segment"
                    ? "border-[#0f766e] text-[#0f172a]"
                    : "border-transparent text-[#94a3b8]"
                }`}
              >
                セグメント
              </button>
            </div>

            {activeTab === "content" ? (
              <>
            <section className="space-y-3 rounded-lg border border-[#e2e8f0] p-3">
              <label className="block space-y-1">
                <span className="text-sm font-semibold text-[#334155]">トリガー条件</span>
                <select
                  value={triggerType}
                  onChange={(event) => {
                    const nextTriggerType = event.target.value as TriggerType;
                    setTriggerType(nextTriggerType);
                    if (nextTriggerType !== "BIRTHDAY" && nextTriggerType !== "GIFT_EXPIRES" && delayDays < 0) {
                      setDelayDays(0);
                    }
                  }}
                  className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-[#0f9f99]"
                >
                  <option value="USER_SIGNUP">会員登録時</option>
                  <option value="CHECKIN_POINT_GRANTED">来店ポイント付与時</option>
                  <option value="RANK_UP">ランクアップ時</option>
                  <option value="BIRTHDAY">誕生日</option>
                  <option value="GIFT_EXPIRES">ギフト期限切れ</option>
                </select>
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-[#475569]">
                    トリガーからの日数（負数: n日前）
                  </span>
                  <input
                    type="number"
                    min={canUseNegativeDelay ? -365 : 0}
                    max={365}
                    value={delayDays}
                    onChange={(event) => {
                      const min = canUseNegativeDelay ? -365 : 0;
                      setDelayDays(Math.max(min, Math.min(365, Number(event.target.value || 0))));
                    }}
                    className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm outline-none focus:border-[#0f9f99]"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-[#475569]">配信時刻（JST）</span>
                  <select
                    value={deliveryHourJst === null ? "" : String(deliveryHourJst)}
                    onChange={(event) => {
                      const raw = event.target.value;
                      setDeliveryHourJst(raw === "" ? null : Number(raw));
                    }}
                    className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm outline-none focus:border-[#0f9f99]"
                  >
                    <option value="">即時配信</option>
                    {Array.from({ length: 24 }).map((_, hour) => (
                      <option key={hour} value={hour}>
                        {`${String(hour).padStart(2, "0")}:00`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-[#334155]">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                  className="h-4 w-4 rounded border-[#cbd5e1]"
                />
                このトリガー配信を有効にする
              </label>
            </section>

            {editorMessages.map((item) => (
              <section
                key={item.id}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDragEnter={() => {
                  setDragOverMessageId(item.id);
                  if (draggedMessageId) moveMessage(draggedMessageId, item.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  finishDragging();
                }}
                className={`mt-3 rounded-lg border p-3 transition ${
                  dragOverMessageId === item.id
                    ? "border-[#0f766e] bg-[#f0fdfa]"
                    : "border-[#e2e8f0]"
                } ${draggedMessageId === item.id ? "opacity-60" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) => handleDragStart(event, item.id)}
                      onDragEnd={finishDragging}
                      aria-label="ドラッグして並べ替え"
                      title="ドラッグして並べ替え"
                      className="cursor-grab rounded px-1.5 py-1 text-lg leading-none text-[#94a3b8] active:cursor-grabbing"
                    >
                      ⠿
                    </button>
                    <p className="text-sm font-semibold text-[#334155]">
                      {item.type === "text" ? "本文テキスト" : item.type === "image" ? "画像" : "ギフト"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => removeMessage(item.id)}
                      className="rounded border border-[#fecaca] px-2 py-1 text-xs font-semibold text-[#b91c1c]"
                    >
                      削除
                    </button>
                  </div>
                </div>

                {item.type === "text" ? (
                  <textarea
                    value={item.text}
                    onChange={(event) => {
                      const text = event.target.value;
                      setEditorMessages((prev) =>
                        prev.map((messageItem) =>
                          messageItem.id === item.id && messageItem.type === "text"
                            ? { ...messageItem, text }
                            : messageItem,
                        ),
                      );
                    }}
                    placeholder="配信するメッセージ本文"
                    rows={7}
                    className="mt-2 w-full resize-y rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-[#0f9f99]"
                  />
                ) : null}

                {item.type === "image" ? (
                  <>
                    <p className="mt-1 text-sm text-[#64748b]">画像を選択できます</p>
                    <div className="mt-3 rounded-lg border border-[#e2e8f0] bg-[#fafafa] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-14 w-14 overflow-hidden rounded border border-[#dbe2ea] bg-white">
                            {item.previewUrl ? (
                              <img src={item.previewUrl} alt="選択画像プレビュー" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-[#94a3b8]">画像</div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-[#64748b]">画像</p>
                            <p className="truncate text-lg font-semibold text-[#0f172a]">
                              {item.file?.name ?? (item.uploadedUrl ? "設定済み画像" : "未設定")}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => imageInputRefs.current[item.id]?.click()}
                          disabled={isUploadingImage}
                          className="rounded-lg border border-[#cbd5e1] px-4 py-2 text-sm font-semibold text-[#334155]"
                        >
                          {isUploadingImage ? "アップロード中..." : "変更"}
                        </button>
                      </div>
                    </div>
                    <input
                      ref={(element) => {
                        imageInputRefs.current[item.id] = element;
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => handleImageFileChange(item.id, event)}
                    />
                  </>
                ) : null}

                {item.type === "gift" ? (
                  <>
                    <p className="mt-1 text-sm text-[#64748b]">配信に使用するギフトを設定できます</p>
                    <div className="mt-3 rounded-lg border border-[#e2e8f0] bg-[#fafafa] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-14 w-14 overflow-hidden rounded border border-[#dbe2ea] bg-white">
                            {item.gift?.previewImageUrl || (item.existingMessage && getFlexHeroUrl(item.existingMessage)) ? (
                              <img
                                src={item.gift?.previewImageUrl ?? getFlexHeroUrl(item.existingMessage!)!}
                                alt={item.gift?.title ?? getFlexTitle(item.existingMessage!)}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-[#94a3b8]">🎁</div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-[#64748b]">ギフト</p>
                            <p className="truncate text-lg font-semibold text-[#0f172a]">
                              {item.gift?.title ??
                                (item.existingMessage ? getFlexTitle(item.existingMessage) : "未設定")}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setGiftSheetMessageId(item.id)}
                          className="rounded-lg border border-[#cbd5e1] px-4 py-2 text-sm font-semibold text-[#334155]"
                        >
                          変更
                        </button>
                      </div>
                    </div>
                    {item.gift || item.existingMessage ? (
                      <label className="mt-3 block space-y-1">
                        <span className="text-xs font-semibold text-[#475569]">
                          通知に表示するテキスト（任意）
                        </span>
                        <input
                          value={item.altText}
                          onChange={(event) => {
                            const altText = event.target.value;
                            setEditorMessages((prev) =>
                              prev.map((messageItem) =>
                                messageItem.id === item.id && messageItem.type === "gift"
                                  ? { ...messageItem, altText }
                                  : messageItem,
                              ),
                            );
                          }}
                          maxLength={400}
                          placeholder={`未入力の場合は「${
                            item.gift?.title ??
                            (item.existingMessage
                              ? getFlexTitle(item.existingMessage)
                              : "ギフト")
                          }」`}
                          className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm outline-none focus:border-[#0f9f99]"
                        />
                        <span className="block text-xs text-[#64748b]">
                          LINEの通知に表示されます。未入力の場合はギフト名が表示されます。
                        </span>
                      </label>
                    ) : null}
                  </>
                ) : null}
              </section>
            ))}

            <section className="mt-3 rounded-lg border border-[#e2e8f0] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#334155]">追加する要素</p>
                <p className="text-xs font-semibold text-[#64748b]">{editorMessages.length} / 5件</p>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2 text-center text-xs text-[#334155]">
                <button
                  type="button"
                  onClick={addTextMessage}
                  disabled={editorMessages.length >= MAX_MESSAGE_COUNT}
                  className="rounded border border-[#dbe2ea] bg-[#f8fafc] px-2 py-3 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  テキスト
                </button>
                <button
                  type="button"
                  onClick={addImageMessage}
                  disabled={editorMessages.length >= MAX_MESSAGE_COUNT}
                  className="rounded border border-[#dbe2ea] bg-[#f8fafc] px-2 py-3 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  画像
                </button>
                <button
                  type="button"
                  onClick={addGiftMessage}
                  disabled={editorMessages.length >= MAX_MESSAGE_COUNT}
                  className="rounded border border-[#dbe2ea] bg-[#f8fafc] px-2 py-3 disabled:cursor-not-allowed disabled:opacity-40"
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
              </>
            ) : (
              <section className="space-y-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-4">
                <p className="text-sm font-semibold text-[#334155]">送信対象の絞り込み</p>
                <p className="text-xs text-[#64748b]">未選択の条件は「すべて対象」になります。</p>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#475569]">ランク（複数選択）</p>
                  <div className="flex flex-wrap gap-2">
                    {rankOptions.map((rank) => {
                      const checked = targetRankIds.includes(rank.id);
                      return (
                        <button
                          key={rank.id}
                          type="button"
                          onClick={() => toggleRankTarget(rank.id)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                            checked
                              ? "border-[#0f766e] bg-[#ccfbf1] text-[#0f766e]"
                              : "border-[#cbd5e1] bg-white text-[#475569]"
                          }`}
                        >
                          {rank.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-[#475569]">性別</span>
                  <select
                    value={targetGender ?? ""}
                    onChange={(event) => {
                      const value = event.target.value as "male" | "female" | "other" | "";
                      setTargetGender(value ? value : null);
                    }}
                    className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm outline-none focus:border-[#0f9f99]"
                  >
                    <option value="">すべて</option>
                    {genderOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#475569]">来店回数（複数選択）</p>
                  <div className="flex flex-wrap gap-2">
                    {visitCountSegmentOptions.map((segment) => {
                      const checked = targetVisitCountSegments.includes(segment.value);
                      return (
                        <button
                          key={segment.value}
                          type="button"
                          onClick={() => toggleVisitCountTarget(segment.value)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                            checked
                              ? "border-[#0f766e] bg-[#ccfbf1] text-[#0f766e]"
                              : "border-[#cbd5e1] bg-white text-[#475569]"
                          }`}
                        >
                          {segment.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}
          </div>

          <aside className="bg-[#9db8de] p-4">
            <div className="mx-auto w-full max-w-[320px] rounded-2xl bg-[#84a5d3] p-3 shadow-inner">
              <div className="mb-3 h-10 w-10 rounded-full bg-[#6d8fbe]" />

              {editorMessages.map((item) => {
                if (item.type === "text") {
                  return (
                    <div key={item.id} className="mb-3 w-fit max-w-[92%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">
                      <p className="whitespace-pre-wrap text-[15px] text-[#0f172a]">
                        {item.text.trim() || "配信メッセージを入力するとここに表示されます。"}
                      </p>
                      <p className="mt-2 text-[11px] font-semibold text-[#94a3b8]">
                        type: text / trigger: {triggerTypeLabel[triggerType]}
                      </p>
                    </div>
                  );
                }
                if (item.type === "image") {
                  return (
                    <div key={item.id} className="mb-3 w-[92%] overflow-hidden rounded-2xl bg-white shadow-sm">
                      {item.previewUrl ? (
                        <img src={item.previewUrl} alt="LINE画像メッセージプレビュー" className="h-44 w-full object-cover" />
                      ) : (
                        <div className="flex h-44 items-center justify-center text-xs text-[#94a3b8]">画像未設定</div>
                      )}
                      <div className="px-3 py-2">
                        <p className="text-[11px] font-semibold text-[#94a3b8]">
                          type: image / trigger: {triggerTypeLabel[triggerType]}
                        </p>
                      </div>
                    </div>
                  );
                }
                const existingHeroUrl = item.existingMessage ? getFlexHeroUrl(item.existingMessage) : null;
                const giftTitle =
                  item.gift?.title ?? (item.existingMessage ? getFlexTitle(item.existingMessage) : "ギフト未設定");
                return (
                  <div key={item.id} className="mb-3 w-[92%] overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="h-52 w-full overflow-hidden bg-[#d1fae5]">
                      {item.gift?.previewImageUrl || existingHeroUrl ? (
                        <img
                          src={item.gift?.previewImageUrl ?? existingHeroUrl ?? ""}
                          alt={giftTitle}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-[#94a3b8]">ギフト画像未設定</div>
                      )}
                    </div>
                    <div className="space-y-2 p-4">
                      <p className="text-3xl font-bold leading-tight text-[#111827]">{giftTitle}</p>
                      <p className="text-sm text-[#6b7280]">
                        {item.gift?.usageGuide?.trim() || "タップして獲得してください"}
                      </p>
                      <button
                        type="button"
                        className="w-full rounded-lg bg-[#0f9f99] px-3 py-3 text-base font-bold text-white"
                      >
                        このギフトを獲得する
                      </button>
                      <p className="text-[11px] font-semibold text-[#94a3b8]">
                        type: flex / trigger: {triggerTypeLabel[triggerType]}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div className="text-right text-xs text-[#5f7fa8]">07:19</div>
            </div>
          </aside>
        </div>
      </form>
      {toast ? (
        <div
          className={`fixed inset-x-0 bottom-20 z-50 mx-auto w-fit rounded-full px-4 py-2 text-sm font-semibold text-white ${
            isError ? "bg-[#b91c1c]" : "bg-[#111827]"
          }`}
        >
          {toast}
        </div>
      ) : null}
      {giftSheetMessageId ? (
        <div className="fixed inset-0 z-50 bg-black/30">
          <button
            type="button"
            aria-label="close gift sheet"
            className="absolute inset-0"
            onClick={() => setGiftSheetMessageId(null)}
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
                      setEditorMessages((prev) =>
                        prev.map((item) =>
                          item.id === giftSheetMessageId && item.type === "gift"
                            ? { ...item, gift, existingMessage: null }
                            : item,
                        ),
                      );
                      setGiftSheetMessageId(null);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left ${
                      editorMessages.some(
                        (item) =>
                          item.id === giftSheetMessageId &&
                          item.type === "gift" &&
                          item.gift?.id === gift.id,
                      )
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
