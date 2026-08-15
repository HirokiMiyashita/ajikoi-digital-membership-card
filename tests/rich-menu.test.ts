import { describe, expect, it } from "vitest";

import {
  RICH_MENU_TEMPLATES,
  parseRichMenuActions,
} from "@/lib/rich-menu";

describe("リッチメニューテンプレート", () => {
  it("すべてのタップ領域がメニューの範囲内に収まる", () => {
    for (const template of RICH_MENU_TEMPLATES) {
      for (const area of template.areas) {
        expect(area.x).toBeGreaterThanOrEqual(0);
        expect(area.y).toBeGreaterThanOrEqual(0);
        expect(area.width).toBeGreaterThan(0);
        expect(area.height).toBeGreaterThan(0);
        expect(area.x + area.width).toBeLessThanOrEqual(template.width);
        expect(area.y + area.height).toBeLessThanOrEqual(template.height);
      }
    }
  });

  it("保存値が不足・不正でもテンプレート数の安全なアクションへ補正する", () => {
    expect(
      parseRichMenuActions(
        [
          { type: "uri", uri: "https://liff.line.me/example" },
          { type: "unknown", value: "invalid" },
        ],
        3,
      ),
    ).toEqual([
      { type: "uri", uri: "https://liff.line.me/example" },
      { type: "none" },
      { type: "none" },
    ]);
  });
});
