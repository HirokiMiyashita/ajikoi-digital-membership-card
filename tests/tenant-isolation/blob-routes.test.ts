import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const blobMocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}));

vi.mock("@vercel/blob", () => blobMocks);
vi.mock("@/lib/admin-auth", () => ({
  adminAuth: {
    api: {
      getSession: async () => ({
        user: { username: "blob-test-admin-a" },
      }),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET as getBlob } from "@/app/api/admin/blob/route";
import { POST as uploadGiftImage } from "@/app/api/admin/gifts/upload/route";

const storeId = "blob-test-store-a";
const adminId = "blob-test-admin-a";

beforeAll(async () => {
  await prisma.adminUser.deleteMany({ where: { id: adminId } });
  await prisma.officialAccount.deleteMany({ where: { id: storeId } });
  await prisma.officialAccount.create({
    data: {
      id: storeId,
      slug: "blob-test-a",
      lineBasicId: "@blob-test-a",
      name: "Blobテスト店舗A",
    },
  });
  await prisma.adminUser.create({
    data: { id: adminId, officialAccountId: storeId },
  });
});

beforeEach(() => {
  blobMocks.get.mockReset();
  blobMocks.put.mockReset();
});

afterAll(async () => {
  await prisma.adminUser.deleteMany({ where: { id: adminId } });
  await prisma.officialAccount.deleteMany({ where: { id: storeId } });
  await prisma.$disconnect();
});

describe("Blobのテナント分離", () => {
  it("他店舗のパスを読み取れない", async () => {
    const response = await getBlob(
      new Request(
        "http://localhost/api/admin/blob?pathname=stores/blob-test-store-b/gifts/secret.png",
      ),
    );
    expect(response.status).toBe(403);
    expect(blobMocks.get).not.toHaveBeenCalled();
  });

  it("アップロード先にログイン店舗IDを必ず含める", async () => {
    blobMocks.put.mockResolvedValue({
      url: "https://example.com/image.png",
    });
    const form = new FormData();
    form.set("file", new File(["image"], "店舗 ロゴ.png", { type: "image/png" }));
    const response = await uploadGiftImage(
      new Request("http://localhost/api/admin/gifts/upload", {
        method: "POST",
        body: form,
      }),
    );
    expect(response.status).toBe(200);
    expect(blobMocks.put).toHaveBeenCalledWith(
      expect.stringMatching(/^stores\/blob-test-store-a\/gifts\/\d+-[^/]+\.png$/),
      expect.any(File),
      expect.any(Object),
    );
  });
});
