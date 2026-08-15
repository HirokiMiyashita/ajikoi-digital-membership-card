export type RichMenuBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RichMenuAction =
  | { type: "none" }
  | { type: "uri"; uri: string }
  | { type: "message"; text: string }
  | { type: "postback"; data: string; displayText: string };

export type RichMenuTemplate = {
  key: string;
  label: string;
  width: 2500;
  height: 843 | 1686;
  areas: RichMenuBounds[];
};

export const RICH_MENU_TEMPLATES: RichMenuTemplate[] = [
  {
    key: "large-6",
    label: "大・6分割",
    width: 2500,
    height: 1686,
    areas: [
      { x: 0, y: 0, width: 833, height: 843 },
      { x: 833, y: 0, width: 833, height: 843 },
      { x: 1666, y: 0, width: 834, height: 843 },
      { x: 0, y: 843, width: 833, height: 843 },
      { x: 833, y: 843, width: 833, height: 843 },
      { x: 1666, y: 843, width: 834, height: 843 },
    ],
  },
  {
    key: "large-4",
    label: "大・4分割",
    width: 2500,
    height: 1686,
    areas: [
      { x: 0, y: 0, width: 1250, height: 843 },
      { x: 1250, y: 0, width: 1250, height: 843 },
      { x: 0, y: 843, width: 1250, height: 843 },
      { x: 1250, y: 843, width: 1250, height: 843 },
    ],
  },
  {
    key: "large-top-2",
    label: "大・上1＋下2",
    width: 2500,
    height: 1686,
    areas: [
      { x: 0, y: 0, width: 2500, height: 843 },
      { x: 0, y: 843, width: 1250, height: 843 },
      { x: 1250, y: 843, width: 1250, height: 843 },
    ],
  },
  {
    key: "large-left-2",
    label: "大・左1＋右2",
    width: 2500,
    height: 1686,
    areas: [
      { x: 0, y: 0, width: 1250, height: 1686 },
      { x: 1250, y: 0, width: 1250, height: 843 },
      { x: 1250, y: 843, width: 1250, height: 843 },
    ],
  },
  {
    key: "compact-3",
    label: "小・3分割",
    width: 2500,
    height: 843,
    areas: [
      { x: 0, y: 0, width: 833, height: 843 },
      { x: 833, y: 0, width: 833, height: 843 },
      { x: 1666, y: 0, width: 834, height: 843 },
    ],
  },
  {
    key: "compact-2",
    label: "小・2分割",
    width: 2500,
    height: 843,
    areas: [
      { x: 0, y: 0, width: 1250, height: 843 },
      { x: 1250, y: 0, width: 1250, height: 843 },
    ],
  },
];

export function getRichMenuTemplate(templateKey: string) {
  return RICH_MENU_TEMPLATES.find((template) => template.key === templateKey) ?? null;
}

export function createEmptyRichMenuActions(count: number): RichMenuAction[] {
  return Array.from({ length: count }, () => ({ type: "none" }));
}

export function isRichMenuAction(value: unknown): value is RichMenuAction {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const action = value as Record<string, unknown>;
  if (action.type === "none") return true;
  if (action.type === "uri") return typeof action.uri === "string";
  if (action.type === "message") return typeof action.text === "string";
  return (
    action.type === "postback" &&
    typeof action.data === "string" &&
    typeof action.displayText === "string"
  );
}

export function parseRichMenuActions(value: unknown, count: number): RichMenuAction[] {
  if (!Array.isArray(value)) return createEmptyRichMenuActions(count);
  return Array.from({ length: count }, (_, index) =>
    isRichMenuAction(value[index]) ? value[index] : { type: "none" },
  );
}
