"use client";

import Link from "next/link";
import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

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
type DeliveryVisitCountSegment = "ZERO" | "ONE" | "TWO_TO_FOUR" | "FIVE_TO_NINE" | "TEN_OR_MORE";
type TextBlock = {
  id: string;
  type: "text";
  text: string;
};
type ImageBlock = {
  id: string;
  type: "image";
  file: File | null;
  previewUrl: string | null;
  uploadedUrl: string | null;
};
type GiftBlock = {
  id: string;
  type: "gift";
  gift: GiftOption | null;
  altText: string;
};
type MessageBlock = TextBlock | ImageBlock | GiftBlock;

const MAX_MESSAGE_BLOCKS = 5;
const createBlockId = () => crypto.randomUUID();

export default function SpotDeliveryEditorClient({ gifts, rankOptions, targetCount }: Props) {
  const [title, setTitle] = useState("");
  const [activeTab, setActiveTab] = useState<"content" | "segment">("content");
  const [blocks, setBlocks] = useState<MessageBlock[]>([]);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);
  const [isGiftSheetOpen, setIsGiftSheetOpen] = useState(false);
  const [editingGiftBlockId, setEditingGiftBlockId] = useState<string | null>(null);
  const [targetRankIds, setTargetRankIds] = useState<string[]>([]);
  const [targetGender, setTargetGender] = useState<"male" | "female" | "other" | null>(null);
  const [targetVisitCountSegments, setTargetVisitCountSegments] = useState<DeliveryVisitCountSegment[]>([]);
  const [liveTargetCount, setLiveTargetCount] = useState(targetCount);
  const [isLoadingTargetCount, setIsLoadingTargetCount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const blocksRef = useRef<MessageBlock[]>([]);

  const canSubmit = useMemo(() => {
    if (blocks.length === 0 || blocks.length > MAX_MESSAGE_BLOCKS) return false;
    return blocks.every((block) => {
      if (block.type === "text") return block.text.trim().length > 0;
      if (block.type === "image") return Boolean(block.file || block.uploadedUrl);
      return Boolean(block.gift);
    });
  }, [blocks]);
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

  const showToast = (text: string, error = false) => {
    setToast(text);
    setIsError(error);
    setTimeout(() => setToast(null), 2400);
  };

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsLoadingTargetCount(true);
      try {
        const response = await fetch("/api/admin/spot-delivery/targets/count", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rankIds: targetRankIds,
            gender: targetGender,
            visitCountSegments: targetVisitCountSegments,
          }),
        });
        const json = (await response.json()) as { ok?: boolean; count?: number };
        if (!cancelled && response.ok && json.ok && typeof json.count === "number") {
          setLiveTargetCount(json.count);
        }
      } catch {
        // 件数表示のためだけのAPIなので失敗時は静かに無視する
      } finally {
        if (!cancelled) {
          setIsLoadingTargetCount(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [targetGender, targetRankIds, targetVisitCountSegments]);

  const handleSaveDraft = () => {
    showToast("下書きを保存しました。");
  };

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  useEffect(() => {
    return () => {
      blocksRef.current.forEach((block) => {
        if (block.type === "image" && block.previewUrl) {
          URL.revokeObjectURL(block.previewUrl);
        }
      });
    };
  }, []);

  const addBlock = (type: MessageBlock["type"]) => {
    if (blocks.length >= MAX_MESSAGE_BLOCKS) return;
    const id = createBlockId();
    if (type === "text") {
      setBlocks((prev) =>
        prev.length >= MAX_MESSAGE_BLOCKS ? prev : [...prev, { id, type, text: "" }],
      );
      return;
    }
    if (type === "image") {
      setBlocks((prev) =>
        prev.length >= MAX_MESSAGE_BLOCKS
          ? prev
          : [...prev, { id, type, file: null, previewUrl: null, uploadedUrl: null }],
      );
      return;
    }
    setBlocks((prev) =>
      prev.length >= MAX_MESSAGE_BLOCKS ? prev : [...prev, { id, type, gift: null, altText: "" }],
    );
    setEditingGiftBlockId(id);
    setIsGiftSheetOpen(true);
  };

  const openGiftSheet = (blockId: string) => {
    setEditingGiftBlockId(blockId);
    setIsGiftSheetOpen(true);
  };

  const updateTextBlock = (blockId: string, text: string) => {
    setBlocks((prev) =>
      prev.map((block) => (block.id === blockId && block.type === "text" ? { ...block, text } : block)),
    );
  };

  const updateImageBlock = (blockId: string, file: File) => {
    const current = blocks.find((block) => block.id === blockId);
    if (current?.type === "image" && current.previewUrl) {
      URL.revokeObjectURL(current.previewUrl);
    }
    const previewUrl = URL.createObjectURL(file);
    setBlocks((prev) =>
      prev.map((block) =>
        block.id === blockId && block.type === "image"
          ? { ...block, file, previewUrl, uploadedUrl: null }
          : block,
      ),
    );
  };

  const removeBlock = (blockId: string) => {
    const current = blocks.find((block) => block.id === blockId);
    if (current?.type === "image" && current.previewUrl) {
      URL.revokeObjectURL(current.previewUrl);
    }
    setBlocks((prev) => prev.filter((block) => block.id !== blockId));
    if (editingGiftBlockId === blockId) {
      setEditingGiftBlockId(null);
      setIsGiftSheetOpen(false);
    }
  };

  const moveBlock = (sourceId: string, destinationId: string) => {
    if (sourceId === destinationId) return;
    setBlocks((prev) => {
      const sourceIndex = prev.findIndex((block) => block.id === sourceId);
      const destinationIndex = prev.findIndex((block) => block.id === destinationId);
      if (sourceIndex < 0 || destinationIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      if (!moved) return prev;
      next.splice(destinationIndex, 0, moved);
      return next;
    });
  };

  const handleDragStart = (event: DragEvent<HTMLElement>, blockId: string) => {
    setDraggedBlockId(blockId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", blockId);
  };

  const finishDragging = () => {
    setDraggedBlockId(null);
    setDragOverBlockId(null);
  };

  const uploadImagesIfNeeded = async (sourceBlocks: MessageBlock[]): Promise<MessageBlock[]> => {
    setIsUploadingImage(true);
    try {
      const uploadedBlocks = await Promise.all(
        sourceBlocks.map(async (block): Promise<MessageBlock> => {
          if (block.type !== "image" || !block.file || block.uploadedUrl) return block;
          const formData = new FormData();
          formData.append("file", block.file);
          const response = await fetch("/api/admin/gifts/upload", {
            method: "POST",
            body: formData,
          });
          const json = (await response.json()) as { ok: boolean; imagePath?: string; message?: string };
          if (!response.ok || !json.ok || !json.imagePath) {
            throw new Error(json.message ?? "画像アップロードに失敗しました。");
          }
          return { ...block, uploadedUrl: json.imagePath };
        }),
      );
      setBlocks(uploadedBlocks);
      return uploadedBlocks;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const buildLineMessages = (sourceBlocks: MessageBlock[]): LineMessage[] => {
    return sourceBlocks.map((block): LineMessage => {
      if (block.type === "text") {
        return {
          type: "text",
          text: block.text.trim(),
        };
      }
      if (block.type === "image") {
        if (!block.uploadedUrl) {
          throw new Error("画像を選択してください。");
        }
        return {
          type: "image",
          originalContentUrl: block.uploadedUrl,
          previewImageUrl: block.uploadedUrl,
        };
      }
      if (!block.gift) {
        throw new Error("ギフトを選択してください。");
      }
      if (!block.gift.lineImageUrl) {
        throw new Error("選択したギフト画像はLINEから参照できません。ギフト画像を再保存してください。");
      }
      if (/\.svg(\?|$)/i.test(block.gift.lineImageUrl)) {
        throw new Error("テンプレートSVG画像はLINE Flexで表示できません。PNG/JPEG画像のギフトを選択してください。");
      }
      const buttonUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/?giftId=${encodeURIComponent(block.gift.id)}`
          : `https://example.com/?giftId=${encodeURIComponent(block.gift.id)}`;
      return {
        type: "flex",
        altText: block.altText.trim() || block.gift.title,
        contents: {
          type: "bubble",
          hero: {
            type: "image",
            url: block.gift.lineImageUrl,
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
                text: block.gift.title,
                weight: "bold",
                size: "xl",
                wrap: true,
              },
              {
                type: "text",
                text: block.gift.usageGuide?.trim() || "タップして獲得してください",
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
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const uploadedBlocks = await uploadImagesIfNeeded(blocks);
      const lineMessages = buildLineMessages(uploadedBlocks);
      if (lineMessages.length === 0) {
        showToast("配信メッセージを1つ以上追加してください。", true);
        return;
      }
      const response = await fetch("/api/admin/spot-delivery/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          notificationText:
            lineMessages.find((message): message is LineFlexMessage => message.type === "flex")
              ?.altText ?? "",
          messages: lineMessages,
          targetFilters: {
            rankIds: targetRankIds,
            gender: targetGender,
            visitCountSegments: targetVisitCountSegments,
          },
        }),
      });
      const json = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !json.ok) {
        showToast(json.message ?? "配信に失敗しました。", true);
        return;
      }
      showToast("配信ジョブを開始しました。");
      setTitle("");
      uploadedBlocks.forEach((block) => {
        if (block.type === "image" && block.previewUrl) {
          URL.revokeObjectURL(block.previewUrl);
        }
      });
      setBlocks([]);
      setTargetRankIds([]);
      setTargetGender(null);
      setTargetVisitCountSegments([]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "通信エラーが発生しました。", true);
    } finally {
      setIsSubmitting(false);
    }
  };
  const editingGift =
    blocks.find((block): block is GiftBlock => block.id === editingGiftBlockId && block.type === "gift")
      ?.gift ?? null;

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
              aria-label="管理用タイトル（配信履歴に表示）"
              className="w-52 rounded border border-transparent px-2 py-1 text-base font-bold outline-none focus:border-[#cbd5e1]"
            />
          </div>
          <div className="flex items-center gap-2">
            <p className="hidden text-xs text-[#64748b] md:block">
              配信対象 {isLoadingTargetCount ? "..." : liveTargetCount}人
            </p>
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
                {blocks.map((block) => (
                  <section
                    key={block.id}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDragEnter={() => {
                      setDragOverBlockId(block.id);
                      if (draggedBlockId) moveBlock(draggedBlockId, block.id);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      finishDragging();
                    }}
                    className={`mt-3 rounded-lg border p-3 transition ${
                      dragOverBlockId === block.id
                        ? "border-[#0f766e] bg-[#f0fdfa]"
                        : "border-[#e2e8f0]"
                    } ${draggedBlockId === block.id ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          draggable
                          onDragStart={(event) => handleDragStart(event, block.id)}
                          onDragEnd={finishDragging}
                          aria-label="ドラッグして並べ替え"
                          title="ドラッグして並べ替え"
                          className="cursor-grab rounded px-1.5 py-1 text-lg leading-none text-[#94a3b8] active:cursor-grabbing"
                        >
                          ⠿
                        </button>
                        <p className="text-sm font-semibold text-[#334155]">
                          {block.type === "text" ? "本文テキスト" : block.type === "image" ? "画像" : "ギフト"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => removeBlock(block.id)}
                          className="rounded border border-[#fecaca] px-2 py-1 text-xs font-semibold text-[#dc2626]"
                        >
                          削除
                        </button>
                      </div>
                    </div>

                    {block.type === "text" ? (
                      <textarea
                        value={block.text}
                        onChange={(event) => updateTextBlock(block.id, event.target.value)}
                        placeholder="配信本文を入力してください"
                        className="mt-2 min-h-[120px] w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-[#0f766e]"
                      />
                    ) : null}

                    {block.type === "image" ? (
                      <>
                        <p className="mt-1 text-sm text-[#64748b]">画像を選択できます</p>
                        <div className="mt-3 rounded-lg border border-[#e2e8f0] bg-[#fafafa] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="h-14 w-14 overflow-hidden rounded border border-[#dbe2ea] bg-white">
                                {block.previewUrl ? (
                                  <img src={block.previewUrl} alt="選択画像プレビュー" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-xs text-[#94a3b8]">画像</div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-[#64748b]">画像</p>
                                <p className="truncate text-lg font-semibold text-[#0f172a]">
                                  {block.file?.name ?? "未設定"}
                                </p>
                              </div>
                            </div>
                            <label className="cursor-pointer rounded-lg border border-[#cbd5e1] px-4 py-2 text-sm font-semibold text-[#334155]">
                              変更
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={isUploadingImage}
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (file) updateImageBlock(block.id, file);
                                  event.target.value = "";
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </>
                    ) : null}

                    {block.type === "gift" ? (
                      <>
                        <p className="mt-1 text-sm text-[#64748b]">配信に使用するギフトを設定できます</p>
                        <div className="mt-3 rounded-lg border border-[#e2e8f0] bg-[#fafafa] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="h-14 w-14 overflow-hidden rounded border border-[#dbe2ea] bg-white">
                                {block.gift ? (
                                  <img src={block.gift.previewImageUrl} alt={block.gift.title} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-xs text-[#94a3b8]">🎁</div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-[#64748b]">ギフト</p>
                                <p className="truncate text-lg font-semibold text-[#0f172a]">
                                  {block.gift?.title ?? "未設定"}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => openGiftSheet(block.id)}
                              className="rounded-lg border border-[#cbd5e1] px-4 py-2 text-sm font-semibold text-[#334155]"
                            >
                              変更
                            </button>
                          </div>
                        </div>
                        {block.gift ? (
                          <label className="mt-3 block space-y-1">
                            <span className="text-xs font-semibold text-[#475569]">
                              通知に表示するテキスト（任意）
                            </span>
                            <input
                              value={block.altText}
                              onChange={(event) => {
                                const altText = event.target.value;
                                setBlocks((prev) =>
                                  prev.map((item) =>
                                    item.id === block.id && item.type === "gift"
                                      ? { ...item, altText }
                                      : item,
                                  ),
                                );
                              }}
                              maxLength={400}
                              placeholder={`未入力の場合は「${block.gift.title}」`}
                              className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm outline-none focus:border-[#0f766e]"
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
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#334155]">追加する要素</p>
                    <p className="text-xs font-semibold text-[#64748b]">{blocks.length} / {MAX_MESSAGE_BLOCKS}件</p>
                  </div>
                  <div className="mt-3 grid grid-cols-5 gap-2 text-center text-xs text-[#334155]">
                    <button
                      type="button"
                      onClick={() => addBlock("text")}
                      disabled={blocks.length >= MAX_MESSAGE_BLOCKS}
                      className="rounded border border-[#dbe2ea] bg-[#f8fafc] px-2 py-3 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      テキスト
                    </button>
                    <button
                      type="button"
                      onClick={() => addBlock("image")}
                      disabled={blocks.length >= MAX_MESSAGE_BLOCKS}
                      className="rounded border border-[#dbe2ea] bg-[#f8fafc] px-2 py-3 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      画像
                    </button>
                    <button
                      type="button"
                      onClick={() => addBlock("gift")}
                      disabled={blocks.length >= MAX_MESSAGE_BLOCKS}
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
              <section className="rounded-lg border border-[#e2e8f0] p-4">
                <p className="text-sm font-semibold text-[#334155]">送信対象の絞り込み</p>
                <p className="mt-1 text-xs text-[#64748b]">未選択の項目はすべて対象です。</p>

                <div className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[#475569]">会員ランク（複数選択）</p>
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
                      <option value="male">男性</option>
                      <option value="female">女性</option>
                      <option value="other">その他</option>
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
                </div>
              </section>
            )}
          </div>

          <aside className="bg-[#9db8de] p-4">
            <div className="mx-auto w-full max-w-[320px] rounded-2xl bg-[#84a5d3] p-3 shadow-inner">
              <div className="mb-3 h-10 w-10 rounded-full bg-[#6d8fbe]" />

              {blocks.map((block) => {
                if (block.type === "text") {
                  return (
                    <div key={block.id} className="mb-3 w-fit max-w-[92%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">
                      <p className="whitespace-pre-wrap text-[15px] text-[#0f172a]">
                        {block.text.trim() || "本文を入力して下さい"}
                      </p>
                      <p className="mt-2 text-[11px] font-semibold text-[#94a3b8]">type: text</p>
                    </div>
                  );
                }
                if (block.type === "image") {
                  return (
                    <div key={block.id} className="mb-3 w-[92%] overflow-hidden rounded-2xl bg-white shadow-sm">
                      {block.previewUrl ? (
                        <img src={block.previewUrl} alt="LINE画像メッセージプレビュー" className="h-44 w-full object-cover" />
                      ) : (
                        <div className="flex h-44 items-center justify-center text-xs text-[#94a3b8]">画像未設定</div>
                      )}
                      <div className="px-3 py-2">
                        <p className="text-[11px] font-semibold text-[#94a3b8]">type: image</p>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={block.id} className="mb-3 w-[92%] overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="h-52 w-full overflow-hidden bg-[#d1fae5]">
                      {block.gift ? (
                        <img src={block.gift.previewImageUrl} alt={block.gift.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-[#94a3b8]">ギフト画像未設定</div>
                      )}
                    </div>
                    <div className="space-y-2 p-4">
                      <p className="text-3xl font-bold leading-tight text-[#111827]">
                        {block.gift?.title ?? "ギフト未設定"}
                      </p>
                      <p className="text-sm text-[#6b7280]">
                        {block.gift?.usageGuide?.trim() || "タップして獲得してください"}
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
                );
              })}

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
                      if (editingGiftBlockId) {
                        setBlocks((prev) =>
                          prev.map((block) =>
                            block.id === editingGiftBlockId && block.type === "gift"
                              ? { ...block, gift }
                              : block,
                          ),
                        );
                      }
                      setIsGiftSheetOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left ${
                      editingGift?.id === gift.id
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
