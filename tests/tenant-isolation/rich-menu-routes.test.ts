import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/admin-guard", () => ({
  getCurrentAdminUser: async () => ({
    id: "rich-menu-admin-a",
    officialAccountId: "rich-menu-store-a",
  }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    storeRichMenu: mocks,
    officialAccount: { findUniqueOrThrow: vi.fn() },
  },
}));
vi.mock("@/lib/store", () => ({
  getConfiguredStoreLineAccessToken: vi.fn(),
}));

import { PUT as saveRichMenu } from "@/app/api/admin/rich-menu/route";
import { POST as publishRichMenu } from "@/app/api/admin/rich-menu/publish/route";

beforeEach(() => {
  mocks.upsert.mockReset();
  mocks.findUnique.mockReset();
  mocks.update.mockReset();
});

describe("リッチメニューAPIのテナント分離", () => {
  it("保存先をログイン中の店舗IDに固定する", async () => {
    mocks.upsert.mockResolvedValue({
      id: "menu-a",
      status: "DRAFT",
      lineRichMenuId: null,
      updatedAt: new Date("2026-08-16T00:00:00Z"),
    });

    const response = await saveRichMenu(
      new Request("http://localhost/api/admin/rich-menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "店舗Aメニュー",
          templateKey: "compact-2",
          selected: true,
          chatBarText: "メニュー",
          imageUrl: null,
          areas: [{ type: "none" }, { type: "none" }],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { officialAccountId: "rich-menu-store-a" },
        create: expect.objectContaining({
          officialAccountId: "rich-menu-store-a",
        }),
      }),
    );
  });

  it("公開対象をログイン中の店舗IDだけで検索する", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const response = await publishRichMenu();

    expect(response.status).toBe(404);
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { officialAccountId: "rich-menu-store-a" },
    });
  });
});
