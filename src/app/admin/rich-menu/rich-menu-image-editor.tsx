"use client";

import { PointerEvent, useEffect, useRef, useState } from "react";

const MAX_OUTPUT_SIZE = 1024 * 1024;

type Props = {
  file: File;
  width: number;
  height: number;
  onCancel: () => void;
  onApply: (file: File) => Promise<void>;
};

export default function RichMenuImageEditor({
  file,
  width,
  height,
  onCancel,
  onApply,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [text, setText] = useState("");
  const [textSize, setTextSize] = useState(96);
  const [textColor, setTextColor] = useState("#ffffff");
  const [textY, setTextY] = useState(50);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setOffset({ x: 0, y: 0 });
      setZoom(1);
    };
    image.onerror = () => setError("画像を読み込めませんでした。");
    image.src = objectUrl;
    return () => {
      URL.revokeObjectURL(objectUrl);
      imageRef.current = null;
    };
  }, [file]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.width = width;
    canvas.height = height;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);

    const coverScale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const scale = coverScale * zoom;
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    context.drawImage(
      image,
      (width - drawWidth) / 2 + offset.x,
      (height - drawHeight) / 2 + offset.y,
      drawWidth,
      drawHeight,
    );

    if (text.trim()) {
      context.save();
      context.font = `700 ${textSize}px sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineJoin = "round";
      context.strokeStyle = "rgb(0 0 0 / 55%)";
      context.lineWidth = Math.max(4, textSize / 12);
      context.strokeText(text, width / 2, (height * textY) / 100, width * 0.9);
      context.fillStyle = textColor;
      context.fillText(text, width / 2, (height * textY) / 100, width * 0.9);
      context.restore();
    }
  }, [height, offset, text, textColor, textSize, textY, width, zoom]);

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const previous = dragRef.current;
    const canvas = canvasRef.current;
    if (!previous || !canvas) return;
    const scale = width / canvas.getBoundingClientRect().width;
    setOffset((current) => ({
      x: current.x + (event.clientX - previous.x) * scale,
      y: current.y + (event.clientY - previous.y) * scale,
    }));
    dragRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const createOutputFile = async () => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error("画像を作成できませんでした。");
    let quality = 0.9;
    let blob: Blob | null = null;
    while (quality >= 0.45) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob && blob.size <= MAX_OUTPUT_SIZE) break;
      quality -= 0.1;
    }
    if (!blob || blob.size > MAX_OUTPUT_SIZE) {
      throw new Error("画像を1MB以下に圧縮できませんでした。別の画像をお試しください。");
    }
    return new File([blob], "rich-menu-edited.jpg", { type: "image/jpeg" });
  };

  const handleApply = async () => {
    setIsApplying(true);
    setError(null);
    try {
      await onApply(await createOutputFile());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "画像の適用に失敗しました。");
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-3 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="rich-menu-image-editor-title"
        className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
          <div>
            <h2 id="rich-menu-image-editor-title" className="font-bold text-[#0f172a]">
              画像を編集
            </h2>
            <p className="mt-1 text-xs text-[#64748b]">
              {width}×{height}pxに切り抜いて適用します。
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isApplying}
            aria-label="画像編集を閉じる"
            className="text-2xl text-[#64748b]"
          >
            ×
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex min-h-[300px] items-center justify-center bg-[#f1f5f9] p-4 sm:p-8">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => {
                dragRef.current = null;
              }}
              className="max-h-[62vh] max-w-full cursor-grab touch-none border border-dashed border-[#64748b] bg-white shadow-sm active:cursor-grabbing"
              style={{ aspectRatio: `${width} / ${height}` }}
            />
          </div>

          <div className="space-y-5 border-t border-[#e2e8f0] p-5 lg:border-t-0 lg:border-l">
            <label className="block">
              <span className="mb-2 flex justify-between text-sm font-bold text-[#334155]">
                <span>拡大・縮小</span>
                <span>{Math.round(zoom * 100)}%</span>
              </span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="w-full accent-[#0f766e]"
              />
              <span className="mt-1 block text-xs text-[#64748b]">
                画像をドラッグして表示位置を調整できます。
              </span>
            </label>

            <div className="border-t border-[#e2e8f0] pt-5">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[#334155]">
                  文字を追加（任意）
                </span>
                <input
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={40}
                  placeholder="例：会員証はこちら"
                  className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm"
                />
              </label>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-[#475569]">
                  文字サイズ
                  <input
                    type="number"
                    min="32"
                    max="240"
                    value={textSize}
                    onChange={(event) => setTextSize(Number(event.target.value))}
                    className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-2"
                  />
                </label>
                <label className="text-xs font-semibold text-[#475569]">
                  文字色
                  <input
                    type="color"
                    value={textColor}
                    onChange={(event) => setTextColor(event.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-[#cbd5e1] bg-white p-1"
                  />
                </label>
              </div>
              <label className="mt-3 block text-xs font-semibold text-[#475569]">
                文字の縦位置
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={textY}
                  onChange={(event) => setTextY(Number(event.target.value))}
                  className="mt-1 w-full accent-[#0f766e]"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
                setText("");
              }}
              disabled={isApplying}
              className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm font-bold text-[#475569]"
            >
              編集をリセット
            </button>
          </div>
        </div>

        {error ? (
          <p role="alert" className="shrink-0 bg-[#fef2f2] px-5 py-2 text-sm text-[#b91c1c]">
            {error}
          </p>
        ) : null}
        <footer className="flex shrink-0 justify-end gap-3 border-t border-[#e2e8f0] px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isApplying}
            className="rounded-lg border border-[#cbd5e1] px-4 py-2 text-sm font-bold text-[#475569]"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isApplying}
            className="rounded-lg bg-[#06c755] px-5 py-2 text-sm font-bold text-white disabled:bg-[#94a3b8]"
          >
            {isApplying ? "適用中..." : "編集して適用"}
          </button>
        </footer>
      </section>
    </div>
  );
}
