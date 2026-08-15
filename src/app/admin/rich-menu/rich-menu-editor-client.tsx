"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  RICH_MENU_TEMPLATES,
  RichMenuAction,
  RichMenuTemplate,
  getRichMenuTemplate,
} from "@/lib/rich-menu";

type RichMenuStatus = "DRAFT" | "PUBLISHED" | "ERROR";

type InitialValue = {
  name: string;
  imageUrl: string | null;
  templateKey: string;
  selected: boolean;
  chatBarText: string;
  areas: RichMenuAction[];
  status: RichMenuStatus;
  isPublished: boolean;
  lastError: string | null;
};

type Props = {
  storeName: string;
  liffUrl: string;
  initialValue: InitialValue;
};

type Notice = {
  message: string;
  kind: "success" | "error";
};

const MAX_IMAGE_SIZE = 1024 * 1024;
const AREA_LABELS = "ABCDEFGHIJKLMNOPQRST".split("");

function TemplateDiagram({
  template,
  selectedArea,
}: {
  template: RichMenuTemplate;
  selectedArea?: number;
}) {
  return (
    <span
      className="relative block w-full overflow-hidden rounded-md border border-[#94a3b8] bg-white"
      style={{ aspectRatio: `${template.width} / ${template.height}` }}
      aria-hidden="true"
    >
      {template.areas.map((bounds, index) => (
        <span
          key={`${bounds.x}-${bounds.y}`}
          className={`absolute flex items-center justify-center border border-[#94a3b8] text-[9px] font-bold ${
            selectedArea === index ? "bg-[#0f766e] text-white" : "bg-[#f8fafc] text-[#64748b]"
          }`}
          style={{
            left: `${(bounds.x / template.width) * 100}%`,
            top: `${(bounds.y / template.height) * 100}%`,
            width: `${(bounds.width / template.width) * 100}%`,
            height: `${(bounds.height / template.height) * 100}%`,
          }}
        >
          {AREA_LABELS[index]}
        </span>
      ))}
    </span>
  );
}

async function readResponseMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? fallback;
  } catch {
    return fallback;
  }
}

export default function RichMenuEditorClient({
  storeName,
  liffUrl,
  initialValue,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialValue.name);
  const [chatBarText, setChatBarText] = useState(initialValue.chatBarText);
  const [selected, setSelected] = useState(initialValue.selected);
  const [templateKey, setTemplateKey] = useState(initialValue.templateKey);
  const [imageUrl, setImageUrl] = useState<string | null>(initialValue.imageUrl);
  const [areas, setAreas] = useState<RichMenuAction[]>(initialValue.areas);
  const [selectedArea, setSelectedArea] = useState(0);
  const [status, setStatus] = useState<RichMenuStatus>(initialValue.status);
  const [isPublished, setIsPublished] = useState(initialValue.isPublished);
  const [lastError, setLastError] = useState(initialValue.lastError);
  const [operation, setOperation] = useState<
    "save" | "publish" | "unpublish" | "upload" | null
  >(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const template = useMemo(
    () => getRichMenuTemplate(templateKey) ?? RICH_MENU_TEMPLATES[0],
    [templateKey],
  );
  const currentAction = areas[selectedArea] ?? ({ type: "none" } as const);
  const isBusy = operation !== null;

  const showNotice = (message: string, kind: Notice["kind"]) => {
    setNotice({ message, kind });
    window.setTimeout(() => setNotice(null), 3500);
  };

  const validate = () => {
    if (!name.trim()) return "管理名を入力してください。";
    if (name.trim().length > 300) return "管理名は300文字以内で入力してください。";
    if (!chatBarText.trim()) return "メニューバーのテキストを入力してください。";
    if (chatBarText.trim().length > 14) {
      return "メニューバーのテキストは14文字以内で入力してください。";
    }
    for (const [index, action] of areas.entries()) {
      const areaName = `エリア${AREA_LABELS[index]}`;
      if (action.type === "uri") {
        try {
          const protocol = new URL(action.uri).protocol;
          if (!["https:", "http:", "tel:", "mailto:"].includes(protocol)) {
            return `${areaName}に有効なURLを入力してください。`;
          }
        } catch {
          return `${areaName}に有効なURLを入力してください。`;
        }
        if (action.uri.length > 1000) return `${areaName}のURLが長すぎます。`;
      }
      if (action.type === "message" && (!action.text.trim() || action.text.length > 300)) {
        return `${areaName}のメッセージは1〜300文字で入力してください。`;
      }
      if (
        action.type === "postback" &&
        (!action.data.trim() ||
          action.data.length > 300 ||
          action.displayText.length > 300)
      ) {
        return `${areaName}のポストバック設定を確認してください。`;
      }
    }
    return null;
  };

  const createBody = () => ({
    name: name.trim(),
    templateKey,
    selected,
    chatBarText: chatBarText.trim(),
    imageUrl,
    areas,
  });

  const saveDraft = async (forPublish = false) => {
    const validationError = validate();
    if (validationError) {
      showNotice(validationError, "error");
      return false;
    }
    const response = await fetch("/api/admin/rich-menu", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBody()),
    });
    if (!response.ok) {
      showNotice(
        await readResponseMessage(response, "リッチメニューの保存に失敗しました。"),
        "error",
      );
      return false;
    }
    setStatus("DRAFT");
    setLastError(null);
    if (!forPublish) showNotice("下書きを保存しました。", "success");
    router.refresh();
    return true;
  };

  const handleSave = async () => {
    if (isBusy) return;
    setOperation("save");
    try {
      await saveDraft();
    } catch {
      showNotice("通信に失敗しました。接続を確認してもう一度お試しください。", "error");
    } finally {
      setOperation(null);
    }
  };

  const handlePublish = async () => {
    if (isBusy) return;
    if (!imageUrl) {
      showNotice("公開するには背景画像をアップロードしてください。", "error");
      return;
    }
    if (areas.every((action) => action.type === "none")) {
      showNotice("公開するには少なくとも1つのアクションを設定してください。", "error");
      return;
    }
    setOperation("publish");
    try {
      if (!(await saveDraft(true))) return;
      const response = await fetch("/api/admin/rich-menu/publish", { method: "POST" });
      if (!response.ok) {
        const message = await readResponseMessage(response, "LINEへの公開に失敗しました。");
        setStatus("ERROR");
        setLastError(message);
        showNotice(message, "error");
        return;
      }
      setStatus("PUBLISHED");
      setIsPublished(true);
      setLastError(null);
      showNotice("LINEへリッチメニューを公開しました。", "success");
      router.refresh();
    } catch {
      showNotice("通信に失敗しました。接続を確認してもう一度お試しください。", "error");
    } finally {
      setOperation(null);
    }
  };

  const handleUnpublish = async () => {
    if (isBusy || !window.confirm("LINEでの公開を解除しますか？")) return;
    setOperation("unpublish");
    try {
      const response = await fetch("/api/admin/rich-menu/publish", { method: "DELETE" });
      if (!response.ok) {
        const message = await readResponseMessage(response, "公開解除に失敗しました。");
        setLastError(message);
        showNotice(message, "error");
        return;
      }
      setStatus("DRAFT");
      setIsPublished(false);
      setLastError(null);
      showNotice("LINEでの公開を解除しました。", "success");
      router.refresh();
    } catch {
      showNotice("通信に失敗しました。接続を確認してもう一度お試しください。", "error");
    } finally {
      setOperation(null);
    }
  };

  const handleTemplateChange = (nextTemplate: RichMenuTemplate) => {
    if (nextTemplate.key === templateKey) return;
    setAreas((current) =>
      Array.from(
        { length: nextTemplate.areas.length },
        (_, index) => current[index] ?? ({ type: "none" } as const),
      ),
    );
    setSelectedArea((current) => Math.min(current, nextTemplate.areas.length - 1));
    if (nextTemplate.width !== template.width || nextTemplate.height !== template.height) {
      setImageUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      showNotice("サイズが変わったため、背景画像を選び直してください。", "success");
    }
    setTemplateKey(nextTemplate.key);
  };

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      event.target.value = "";
      showNotice("PNGまたはJPEG画像を選択してください。", "error");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      event.target.value = "";
      showNotice("画像は1MB以下にしてください。", "error");
      return;
    }

    setOperation("upload");
    try {
      const bitmap = await createImageBitmap(file);
      const dimensionsMatch =
        bitmap.width === template.width && bitmap.height === template.height;
      const actualSize = `${bitmap.width}×${bitmap.height}px`;
      bitmap.close();
      if (!dimensionsMatch) {
        event.target.value = "";
        showNotice(
          `画像サイズが一致しません（選択画像: ${actualSize}、必要: ${template.width}×${template.height}px）。`,
          "error",
        );
        return;
      }

      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/admin/rich-menu/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        event.target.value = "";
        showNotice(
          await readResponseMessage(response, "画像アップロードに失敗しました。"),
          "error",
        );
        return;
      }
      const result = (await response.json()) as { imageUrl?: string };
      if (!result.imageUrl) throw new Error("imageUrl is missing");
      setImageUrl(result.imageUrl);
      showNotice("背景画像をアップロードしました。", "success");
    } catch {
      event.target.value = "";
      showNotice("画像を読み込めませんでした。別の画像をお試しください。", "error");
    } finally {
      setOperation(null);
    }
  };

  const updateAction = (action: RichMenuAction) => {
    setAreas((current) =>
      current.map((item, index) => (index === selectedArea ? action : item)),
    );
  };

  const statusStyle = status === "DRAFT" && isPublished
    ? "bg-[#fef3c7] text-[#92400e]"
    : {
    DRAFT: "bg-[#f1f5f9] text-[#475569]",
    PUBLISHED: "bg-[#dcfce7] text-[#166534]",
    ERROR: "bg-[#fee2e2] text-[#b91c1c]",
  }[status];
  const statusLabel = status === "DRAFT" && isPublished
    ? "公開中・変更あり"
    : {
    DRAFT: "下書き",
    PUBLISHED: "公開中",
    ERROR: "エラー",
  }[status];

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 pb-12 sm:p-6">
      <header className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-[#0f172a]">リッチメニュー</h1>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle}`}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#64748b]">
            {storeName}のLINEトーク画面下部に表示するメニューを編集します。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPublished ? (
            <button
              type="button"
              onClick={handleUnpublish}
              disabled={isBusy}
              className="rounded-lg border border-[#dc2626] bg-white px-4 py-2 text-sm font-bold text-[#dc2626] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {operation === "unpublish" ? "解除中..." : "公開解除"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleSave}
            disabled={isBusy}
            className="rounded-lg border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-bold text-[#334155] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {operation === "save" ? "保存中..." : "下書き保存"}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={isBusy}
            className="rounded-lg bg-[#06c755] px-4 py-2 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
          >
            {operation === "publish" ? "公開中..." : "LINEへ公開"}
          </button>
        </div>
      </header>

      {lastError ? (
        <div role="alert" className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-4 text-sm text-[#b91c1c]">
          <p className="font-bold">前回の処理でエラーが発生しました</p>
          <p className="mt-1 break-words">{lastError}</p>
        </div>
      ) : null}

      <fieldset disabled={isBusy} className="space-y-5 disabled:opacity-75">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="font-bold text-[#0f172a]">基本設定</h2>
            <p className="mt-1 text-xs text-[#64748b]">管理用の名前とLINE上の表示方法を設定します。</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1 flex justify-between text-sm font-semibold text-[#334155]">
                <span>管理名</span>
                <span className="font-normal text-[#64748b]">{name.length}/300</span>
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={300}
                className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#ccfbf1]"
              />
            </label>
            <label className="block">
              <span className="mb-1 flex justify-between text-sm font-semibold text-[#334155]">
                <span>メニューバーのテキスト</span>
                <span className="font-normal text-[#64748b]">{chatBarText.length}/14</span>
              </span>
              <input
                value={chatBarText}
                onChange={(event) => setChatBarText(event.target.value)}
                maxLength={14}
                className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#ccfbf1]"
              />
              <span className="mt-1 block text-xs text-[#64748b]">
                トーク画面でメニューを開閉する部分に表示されます。
              </span>
            </label>
          </div>
          <fieldset className="mt-4">
            <legend className="text-sm font-semibold text-[#334155]">メニューの初期表示</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {[
                { value: true, label: "表示する" },
                { value: false, label: "表示しない" },
              ].map((option) => (
                <label key={String(option.value)} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="selected"
                    checked={selected === option.value}
                    onChange={() => setSelected(option.value)}
                    className="size-4 accent-[#0f766e]"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="font-bold text-[#0f172a]">コンテンツ</h2>
            <p className="mt-1 text-xs text-[#64748b]">
              レイアウト、背景画像、タップ時の動作を設定します。
            </p>
          </div>

          <div className="grid items-start gap-7 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="xl:sticky xl:top-4">
              <h3 className="mb-3 text-sm font-bold text-[#334155]">プレビュー</h3>
              <div className="mx-auto max-w-[340px] overflow-hidden rounded-[2rem] border-[7px] border-[#1e293b] bg-[#edf7f3] shadow-xl">
                <div className="flex items-center justify-between bg-[#263238] px-4 py-3 text-white">
                  <span className="text-xs font-bold">{storeName}</span>
                  <span aria-hidden="true" className="text-sm">•••</span>
                </div>
                <div className="flex h-40 items-end p-3">
                  <span className="max-w-[75%] rounded-xl bg-white px-3 py-2 text-xs text-[#475569] shadow-sm">
                    メニューからご希望の項目を選択してください。
                  </span>
                </div>
                <div
                  className="relative w-full overflow-hidden border-y border-[#94a3b8] bg-[#e2e8f0] bg-cover bg-center"
                  style={{
                    aspectRatio: `${template.width} / ${template.height}`,
                    backgroundImage: imageUrl ? `url("${imageUrl}")` : undefined,
                  }}
                >
                  {!imageUrl ? (
                    <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs font-semibold text-[#64748b]">
                      {template.width}×{template.height}pxの背景画像
                    </div>
                  ) : null}
                  {template.areas.map((bounds, index) => (
                    <button
                      key={`${bounds.x}-${bounds.y}`}
                      type="button"
                      onClick={() => setSelectedArea(index)}
                      aria-label={`エリア${AREA_LABELS[index]}を編集`}
                      aria-pressed={selectedArea === index}
                      className={`absolute flex items-center justify-center border-2 text-lg font-black text-white transition focus:z-10 focus:outline-none focus:ring-2 focus:ring-[#facc15] ${
                        selectedArea === index
                          ? "z-10 border-[#facc15] bg-[#0f766e]/35"
                          : "border-white/80 bg-black/10 hover:bg-black/25"
                      }`}
                      style={{
                        left: `${(bounds.x / template.width) * 100}%`,
                        top: `${(bounds.y / template.height) * 100}%`,
                        width: `${(bounds.width / template.width) * 100}%`,
                        height: `${(bounds.height / template.height) * 100}%`,
                        textShadow: "0 1px 3px rgb(0 0 0 / 80%)",
                      }}
                    >
                      {AREA_LABELS[index]}
                    </button>
                  ))}
                </div>
                <div className="bg-white px-4 py-2 text-center text-xs font-bold text-[#475569]">
                  {chatBarText || "メニュー"}
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-[#64748b]">
                エリアをタップすると右側の編集対象が切り替わります。
              </p>
            </div>

            <div className="min-w-0 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-[#334155]">1. テンプレートを選択</h3>
                <p className="mt-1 text-xs text-[#64748b]">
                  分割数を変更しても、既存アクションはAから順に引き継がれます。
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {RICH_MENU_TEMPLATES.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleTemplateChange(item)}
                      aria-pressed={templateKey === item.key}
                      className={`rounded-xl border p-3 text-left transition ${
                        templateKey === item.key
                          ? "border-[#0f766e] bg-[#f0fdfa] ring-2 ring-[#99f6e4]"
                          : "border-[#cbd5e1] hover:border-[#64748b]"
                      }`}
                    >
                      <TemplateDiagram template={item} />
                      <span className="mt-2 block text-xs font-bold text-[#334155]">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-[#e2e8f0] pt-6">
                <h3 className="text-sm font-bold text-[#334155]">2. 背景画像をアップロード</h3>
                <p className="mt-1 text-xs leading-relaxed text-[#64748b]">
                  PNGまたはJPEG、1MB以下、{template.width}×{template.height}pxの画像を使用してください。
                  ピクセル寸法はアップロード前に確認します。
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer rounded-lg border border-[#0f766e] bg-white px-4 py-2 text-sm font-bold text-[#0f766e] hover:bg-[#f0fdfa]">
                    {operation === "upload" ? "アップロード中..." : imageUrl ? "画像を変更" : "画像を選択"}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={handleImageChange}
                      className="sr-only"
                    />
                  </label>
                  {imageUrl ? (
                    <button
                      type="button"
                      onClick={() => {
                        setImageUrl(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="text-sm font-semibold text-[#dc2626] underline underline-offset-2"
                    >
                      画像を削除
                    </button>
                  ) : null}
                  <span className="text-xs text-[#64748b]">
                    {imageUrl ? "アップロード済み" : "未アップロード"}
                  </span>
                </div>
              </div>

              <div className="border-t border-[#e2e8f0] pt-6">
                <h3 className="text-sm font-bold text-[#334155]">3. アクションを設定</h3>
                <p className="mt-1 text-xs text-[#64748b]">
                  アクションとは、ユーザーがエリアをタップしたときに実行する動作です。
                </p>
                <div className="mt-3 flex flex-wrap gap-2" aria-label="編集するエリア">
                  {areas.map((action, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedArea(index)}
                      aria-pressed={selectedArea === index}
                      className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                        selectedArea === index
                          ? "border-[#0f766e] bg-[#0f766e] text-white"
                          : action.type === "none"
                            ? "border-[#cbd5e1] bg-white text-[#64748b]"
                            : "border-[#86efac] bg-[#f0fdf4] text-[#166534]"
                      }`}
                    >
                      {AREA_LABELS[index]}
                      <span className="ml-1 text-[10px]">
                        {action.type === "none" ? "未設定" : "設定済"}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] p-4">
                  <label className="block">
                    <span className="mb-1 block text-sm font-bold text-[#334155]">
                      エリア{AREA_LABELS[selectedArea]}の動作
                    </span>
                    <select
                      value={currentAction.type}
                      onChange={(event) => {
                        const type = event.target.value as RichMenuAction["type"];
                        if (type === "uri") updateAction({ type, uri: "" });
                        else if (type === "message") updateAction({ type, text: "" });
                        else if (type === "postback") {
                          updateAction({ type, data: "", displayText: "" });
                        } else updateAction({ type: "none" });
                      }}
                      className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm"
                    >
                      <option value="none">未設定</option>
                      <option value="uri">リンク</option>
                      <option value="message">メッセージ</option>
                      <option value="postback">ポストバック</option>
                    </select>
                  </label>

                  {currentAction.type === "uri" ? (
                    <label className="mt-4 block">
                      <span className="mb-1 block text-sm font-semibold text-[#334155]">リンク先URL</span>
                      <input
                        type="url"
                        value={currentAction.uri}
                        onChange={(event) => updateAction({ type: "uri", uri: event.target.value })}
                        placeholder="https://example.com/"
                        maxLength={1000}
                        className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm"
                      />
                      <span className="mt-1 block text-xs text-[#64748b]">
                        WebページやLIFFアプリを開きます。
                      </span>
                      {liffUrl ? (
                        <button
                          type="button"
                          onClick={() => updateAction({ type: "uri", uri: liffUrl })}
                          className="mt-2 rounded-lg border border-[#0f766e] bg-white px-3 py-2 text-xs font-bold text-[#0f766e]"
                        >
                          店舗のLIFF URLを設定
                        </button>
                      ) : null}
                    </label>
                  ) : null}

                  {currentAction.type === "message" ? (
                    <label className="mt-4 block">
                      <span className="mb-1 flex justify-between text-sm font-semibold text-[#334155]">
                        <span>送信するメッセージ</span>
                        <span className="font-normal text-[#64748b]">{currentAction.text.length}/300</span>
                      </span>
                      <textarea
                        value={currentAction.text}
                        onChange={(event) =>
                          updateAction({ type: "message", text: event.target.value })
                        }
                        maxLength={300}
                        rows={3}
                        className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm"
                      />
                      <span className="mt-1 block text-xs text-[#64748b]">
                        タップしたユーザーから、この文面がトークに送信されます。
                      </span>
                    </label>
                  ) : null}

                  {currentAction.type === "postback" ? (
                    <div className="mt-4 space-y-4">
                      <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-[#334155]">送信データ</span>
                        <input
                          value={currentAction.data}
                          onChange={(event) =>
                            updateAction({
                              type: "postback",
                              data: event.target.value,
                              displayText: currentAction.displayText,
                            })
                          }
                          maxLength={300}
                          placeholder="action=reserve"
                          className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm"
                        />
                        <span className="mt-1 block text-xs text-[#64748b]">
                          ポストバックは、画面遷移せずにボットへ処理用データを送る機能です。
                        </span>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-[#334155]">
                          トークに表示するテキスト（任意）
                        </span>
                        <input
                          value={currentAction.displayText}
                          onChange={(event) =>
                            updateAction({
                              type: "postback",
                              data: currentAction.data,
                              displayText: event.target.value,
                            })
                          }
                          maxLength={300}
                          placeholder="予約する"
                          className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm"
                        />
                      </label>
                    </div>
                  ) : null}

                  {currentAction.type === "none" ? (
                    <p className="mt-3 text-xs text-[#64748b]">
                      このエリアをタップしても何も起こりません。
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      </fieldset>

      {notice ? (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`fixed right-4 bottom-4 z-50 max-w-sm rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${
            notice.kind === "error" ? "bg-[#b91c1c]" : "bg-[#166534]"
          }`}
        >
          {notice.message}
        </div>
      ) : null}
    </main>
  );
}
