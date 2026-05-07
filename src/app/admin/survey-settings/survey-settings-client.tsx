"use client";

import { useMemo, useState } from "react";

import {
  type OnboardingSurveyOption,
  type OnboardingSurveyPresetKey,
  type OnboardingSurveyQuestionType,
} from "@/lib/onboarding-survey";

type QuestionRow = {
  id?: string;
  questionKey: string;
  presetKey: OnboardingSurveyPresetKey | null;
  questionType: OnboardingSurveyQuestionType;
  label: string;
  options: OnboardingSurveyOption[];
  placeholder: string | null;
  isEnabled: boolean;
  isRequired: boolean;
  sortOrder: number;
};

type Props = {
  initialQuestions: QuestionRow[];
};

export default function SurveySettingsClient({ initialQuestions }: Props) {
  const [questions, setQuestions] = useState<QuestionRow[]>(
    initialQuestions.slice().sort((a, b) => a.sortOrder - b.sortOrder),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabledQuestions = useMemo(
    () => questions.filter((question) => question.isEnabled).sort((a, b) => a.sortOrder - b.sortOrder),
    [questions],
  );
  const disabledQuestions = useMemo(
    () => questions.filter((question) => !question.isEnabled).sort((a, b) => a.sortOrder - b.sortOrder),
    [questions],
  );

  const updateQuestion = (questionKey: string, updater: (previous: QuestionRow) => QuestionRow) => {
    setQuestions((previous) =>
      previous.map((question) => (question.questionKey === questionKey ? updater(question) : question)),
    );
  };

  const reorderEnabledQuestion = (questionKey: string, direction: "up" | "down") => {
    const current = questions.slice().sort((a, b) => a.sortOrder - b.sortOrder);
    const enabled = current.filter((question) => question.isEnabled);
    const index = enabled.findIndex((question) => question.questionKey === questionKey);
    if (index === -1) return;
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= enabled.length) return;
    const target = enabled[nextIndex];
    const source = enabled[index];
    const updated = current.map((question) => {
      if (question.questionKey === source.questionKey) return { ...question, sortOrder: target.sortOrder };
      if (question.questionKey === target.questionKey) return { ...question, sortOrder: source.sortOrder };
      return question;
    });
    setQuestions(updated);
  };

  const handleEnable = (questionKey: string) => {
    const nextSortOrder = enabledQuestions.length;
    updateQuestion(questionKey, (previous) => ({
      ...previous,
      isEnabled: true,
      sortOrder: nextSortOrder,
    }));
    setIsAddMenuOpen(false);
  };

  const handleDisable = (questionKey: string) => {
    const ordered = questions.slice().sort((a, b) => a.sortOrder - b.sortOrder);
    const target = ordered.find((question) => question.questionKey === questionKey) ?? null;
    if (!target) return;
    if (target.presetKey === null) {
      setQuestions((previous) => previous.filter((question) => question.questionKey !== questionKey));
      return;
    }
    const filtered = ordered.filter((question) => question.questionKey !== questionKey && question.isEnabled);
    const next = ordered.map((question) => {
      if (question.questionKey === questionKey) {
        return {
          ...question,
          isEnabled: false,
          isRequired: false,
        };
      }
      if (!question.isEnabled) return question;
      const nextOrder = filtered.findIndex((row) => row.questionKey === question.questionKey);
      return { ...question, sortOrder: nextOrder === -1 ? question.sortOrder : nextOrder };
    });
    setQuestions(next);
  };

  const addCustomQuestion = () => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const questionKey = `custom_${Date.now()}_${suffix}`;
    const question: QuestionRow = {
      questionKey,
      presetKey: null,
      questionType: "text",
      label: "新しい質問",
      options: [],
      placeholder: "",
      isEnabled: true,
      isRequired: false,
      sortOrder: enabledQuestions.length,
    };
    setQuestions((previous) => [...previous, question]);
    setIsAddMenuOpen(false);
    setIsAddingCustom(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = questions
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((question, index) => ({
          id: question.id,
          questionKey: question.questionKey,
          presetKey: question.presetKey,
          questionType: question.questionType,
          label: question.label,
          options: question.options,
          placeholder: question.placeholder,
          isEnabled: question.isEnabled,
          isRequired: question.isEnabled ? question.isRequired : false,
          sortOrder: index,
        }));
      const response = await fetch("/api/admin/survey-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: payload }),
      });
      if (!response.ok) {
        throw new Error("会員登録アンケートの保存に失敗しました。");
      }
      setQuestions(payload);
      setMessage("変更を保存しました。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "会員登録アンケートの保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative space-y-2">
          <h1 className="text-xl font-bold text-[#0f172a]">会員登録アンケート</h1>
          <button
            type="button"
            onClick={() => setIsAddMenuOpen((previous) => !previous)}
            className="rounded-lg bg-[#0f9f99] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
          >
            + 質問を追加
          </button>
          {isAddMenuOpen ? (
            <div className="absolute left-0 top-full z-10 mt-2 w-72 rounded-lg border border-[#dbe2ea] bg-white p-2 shadow-lg">
              <p className="px-2 pb-1 text-xs font-semibold text-[#64748b]">追加する質問を選択</p>
              <div className="space-y-1">
                {disabledQuestions.map((question) => (
                  <button
                    key={question.questionKey}
                    type="button"
                    onClick={() => handleEnable(question.questionKey)}
                    className="w-full rounded px-2 py-2 text-left text-sm font-semibold text-[#334155] hover:bg-[#f8fafc]"
                  >
                    {question.label}
                  </button>
                ))}
                {disabledQuestions.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-[#64748b]">追加可能なプリセット質問はありません。</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setIsAddMenuOpen(false);
                    setIsAddingCustom(true);
                  }}
                  className="w-full rounded border-t border-[#e2e8f0] px-2 py-2 text-left text-sm font-semibold text-[#0f9f99] hover:bg-[#f8fafc]"
                >
                  + カスタム質問を作成
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="rounded-lg bg-[#0f9f99] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
        >
          {isSaving ? "保存中..." : "変更を保存する"}
        </button>
      </div>

      {message ? <p className="text-sm font-semibold text-[#0f766e]">{message}</p> : null}
      {error ? <p className="text-sm font-semibold text-[#b91c1c]">{error}</p> : null}

      {isAddingCustom ? (
        <section className="rounded-xl border border-[#dbe2ea] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#334155]">カスタム質問を追加</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addCustomQuestion}
                className="rounded bg-[#0f9f99] px-3 py-1 text-xs font-bold text-white"
              >
                追加
              </button>
              <button
                type="button"
                onClick={() => setIsAddingCustom(false)}
                className="rounded border border-[#cbd5e1] px-3 py-1 text-xs font-bold text-[#334155]"
              >
                キャンセル
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-3 rounded-xl border border-[#dbe2ea] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#334155]">質問</h2>
        {enabledQuestions.map((question, index) => (
          <article key={question.questionKey} className="rounded-lg border border-[#e2e8f0] px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="w-full space-y-2">
                {question.presetKey ? (
                  <p className="font-semibold text-[#0f172a]">{question.label}</p>
                ) : (
                  <input
                    value={question.label}
                    onChange={(event) =>
                      updateQuestion(question.questionKey, (previous) => ({
                        ...previous,
                        label: event.target.value,
                      }))
                    }
                    className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm font-semibold text-[#0f172a]"
                  />
                )}
                <p className="text-xs text-[#64748b]">{question.presetKey ? "プリセット" : "カスタム"}</p>
                {!question.presetKey ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      value={question.questionType}
                      onChange={(event) =>
                        updateQuestion(question.questionKey, (previous) => ({
                          ...previous,
                          questionType: event.target.value as OnboardingSurveyQuestionType,
                          options: event.target.value === "single_select" ? previous.options : [],
                        }))
                      }
                      className="rounded border border-[#cbd5e1] px-3 py-2 text-sm"
                    >
                      <option value="text">自由入力</option>
                      <option value="single_select">選択式</option>
                      <option value="date">日付</option>
                    </select>
                    {question.questionType === "text" ? (
                      <input
                        value={question.placeholder ?? ""}
                        onChange={(event) =>
                          updateQuestion(question.questionKey, (previous) => ({
                            ...previous,
                            placeholder: event.target.value,
                          }))
                        }
                        placeholder="プレースホルダー"
                        className="rounded border border-[#cbd5e1] px-3 py-2 text-sm"
                      />
                    ) : null}
                  </div>
                ) : null}
                {question.questionType === "single_select" && !question.presetKey ? (
                  <div className="space-y-2 rounded border border-dashed border-[#cbd5e1] p-2">
                    {question.options.map((option, optionIndex) => (
                      <div key={`${question.questionKey}-${option.value}-${optionIndex}`} className="flex gap-2">
                        <input
                          value={option.label}
                          onChange={(event) =>
                            updateQuestion(question.questionKey, (previous) => {
                              const nextOptions = previous.options.map((item, idx) =>
                                idx === optionIndex
                                  ? {
                                      value: event.target.value.trim() || `option_${idx + 1}`,
                                      label: event.target.value,
                                    }
                                  : item,
                              );
                              return { ...previous, options: nextOptions };
                            })
                          }
                          className="flex-1 rounded border border-[#cbd5e1] px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateQuestion(question.questionKey, (previous) => ({
                              ...previous,
                              options: previous.options.filter((_, idx) => idx !== optionIndex),
                            }))
                          }
                          className="rounded border border-[#cbd5e1] px-2 text-xs"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        updateQuestion(question.questionKey, (previous) => ({
                          ...previous,
                          options: [
                            ...previous.options,
                            { value: `option_${previous.options.length + 1}`, label: `選択肢${previous.options.length + 1}` },
                          ],
                        }))
                      }
                      className="rounded border border-[#cbd5e1] px-2 py-1 text-xs font-semibold"
                    >
                      + 選択肢を追加
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => handleDisable(question.questionKey)}
                className="rounded px-2 py-1 text-sm font-bold text-[#334155] hover:bg-[#f1f5f9]"
              >
                ×
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-[#334155]">
                <input
                  type="checkbox"
                  checked={question.isRequired}
                  onChange={(event) =>
                    updateQuestion(question.questionKey, (previous) => ({
                      ...previous,
                      isRequired: event.target.checked,
                    }))
                  }
                />
                必須
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => reorderEnabledQuestion(question.questionKey, "up")}
                  disabled={index === 0}
                  className="rounded border border-[#cbd5e1] px-2 py-1 text-xs font-semibold text-[#334155] disabled:opacity-40"
                >
                  上へ
                </button>
                <button
                  type="button"
                  onClick={() => reorderEnabledQuestion(question.questionKey, "down")}
                  disabled={index === enabledQuestions.length - 1}
                  className="rounded border border-[#cbd5e1] px-2 py-1 text-xs font-semibold text-[#334155] disabled:opacity-40"
                >
                  下へ
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-3 rounded-xl border border-[#dbe2ea] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#334155]">追加できる質問</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {disabledQuestions.map((question) => (
            <button
              key={question.questionKey}
              type="button"
              onClick={() => handleEnable(question.questionKey)}
              className="rounded-lg border border-dashed border-[#cbd5e1] px-3 py-2 text-left text-sm font-semibold text-[#334155] hover:bg-[#f8fafc]"
            >
              + {question.label}
            </button>
          ))}
          {disabledQuestions.length === 0 ? (
            <p className="text-sm text-[#64748b]">追加可能な質問はありません。</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-[#dbe2ea] bg-white p-4">
        <p className="text-xs text-[#64748b]">
          初期設定は現在の固定アンケート内容を反映しています。必要に応じて表示・必須・順序を変更してください。
        </p>
      </section>
    </div>
  );
}
