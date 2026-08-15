import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("@/lib/admin-auth", () => ({
  adminAuth: {
    api: {
      getSession: async () => ({
        user: { username: "tenant-test-admin-a" },
      }),
    },
  },
}));

vi.mock("@/lib/admin-guard", async () => {
  const { prisma } = await import("@/lib/prisma");
  return {
    getCurrentAdminUser: async () =>
      prisma.adminUser.findUnique({ where: { id: "tenant-test-admin-a" } }),
    requireAdminUser: async () =>
      prisma.adminUser.findUniqueOrThrow({ where: { id: "tenant-test-admin-a" } }),
  };
});

import { prisma } from "@/lib/prisma";
import { PATCH as updateGift } from "@/app/api/admin/gifts/[giftId]/route";
import { PATCH as updateMemberSettings } from "@/app/api/admin/member-settings/route";
import {
  GET as getMemberGifts,
  POST as issueMemberGift,
} from "@/app/api/admin/members/[userId]/gifts/route";
import { PATCH as updateMemberRole } from "@/app/api/admin/members/[userId]/role/route";
import { POST as countDeliveryTargets } from "@/app/api/admin/spot-delivery/targets/count/route";
import { POST as issueGift } from "@/app/api/admin/user-gifts/issue/route";
import { POST as updateVisitGacha } from "@/app/api/admin/visit-gacha/route";

const ids = {
  storeA: "tenant-test-store-a",
  storeB: "tenant-test-store-b",
  adminA: "tenant-test-admin-a",
  adminB: "tenant-test-admin-b",
  userA: "tenant-test-user-a",
  userB: "tenant-test-user-b",
  giftA: "tenant-test-gift-a",
  giftB: "tenant-test-gift-b",
};

async function cleanup() {
  await prisma.userGift.deleteMany({
    where: { userId: { in: [ids.userA, ids.userB] } },
  });
  await prisma.visitGachaSetting.deleteMany({
    where: { officialAccountId: { in: [ids.storeA, ids.storeB] } },
  });
  await prisma.memberBenefitSetting.deleteMany({
    where: { officialAccountId: { in: [ids.storeA, ids.storeB] } },
  });
  await prisma.user.deleteMany({
    where: { userId: { in: [ids.userA, ids.userB] } },
  });
  await prisma.gift.deleteMany({
    where: { id: { in: [ids.giftA, ids.giftB] } },
  });
  await prisma.adminUser.deleteMany({
    where: { id: { in: [ids.adminA, ids.adminB] } },
  });
  await prisma.officialAccount.deleteMany({
    where: { id: { in: [ids.storeA, ids.storeB] } },
  });
}

beforeAll(async () => {
  await cleanup();
  await prisma.rank.upsert({
    where: { id: "regular" },
    create: { id: "regular", name: "レギュラー", minPoints: 0, maxPoints: 99 },
    update: {},
  });
  await prisma.officialAccount.createMany({
    data: [
      {
        id: ids.storeA,
        slug: "tenant-test-a",
        lineBasicId: "@tenant-test-a",
        name: "テスト店舗A",
      },
      {
        id: ids.storeB,
        slug: "tenant-test-b",
        lineBasicId: "@tenant-test-b",
        name: "テスト店舗B",
      },
    ],
  });
  await prisma.adminUser.createMany({
    data: [
      { id: ids.adminA, officialAccountId: ids.storeA },
      { id: ids.adminB, officialAccountId: ids.storeB },
    ],
  });
  await prisma.user.createMany({
    data: [
      { userId: ids.userA, displayName: "会員A", officialAccountId: ids.storeA },
      { userId: ids.userB, displayName: "会員B", officialAccountId: ids.storeB },
    ],
  });
  await prisma.gift.createMany({
    data: [
      {
        id: ids.giftA,
        officialAccountId: ids.storeA,
        title: "特典A",
        usageGuide: "店舗Aのみ",
        expiryType: "DAYS_AFTER_ISSUE",
        expiryDays: 30,
        imageUrl: "https://example.com/a.png",
      },
      {
        id: ids.giftB,
        officialAccountId: ids.storeB,
        title: "特典B",
        usageGuide: "店舗Bのみ",
        expiryType: "DAYS_AFTER_ISSUE",
        expiryDays: 30,
        imageUrl: "https://example.com/b.png",
      },
    ],
  });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("管理者APIのテナント分離", () => {
  it("店舗Bのギフトを店舗Aの会員設定に指定できない", async () => {
    const response = await updateMemberSettings(
      new Request("http://localhost/api/admin/member-settings", {
        method: "PATCH",
        body: JSON.stringify({ signupGiftId: ids.giftB }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("店舗Bのギフトを店舗Aの来店ガチャに指定できない", async () => {
    const response = await updateVisitGacha(
      new Request("http://localhost/api/admin/visit-gacha", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          giftId: ids.giftB,
          winProbability: 10,
          rankWinProbabilities: [],
          isActive: true,
        }),
      }),
    );
    expect(response.status).toBe(404);
  });

  it("店舗Aのギフト候補に店舗Bのギフトを返さない", async () => {
    const response = await getMemberGifts(
      new Request("http://localhost/api/admin/members/a/gifts"),
      { params: Promise.resolve({ userId: ids.userA }) },
    );
    const body = (await response.json()) as {
      availableGifts: Array<{ id: string }>;
    };
    expect(response.status).toBe(200);
    expect(body.availableGifts.map((gift) => gift.id)).toEqual([ids.giftA]);
  });

  it("店舗Bのギフトを店舗Aの会員へ付与できない", async () => {
    const response = await issueMemberGift(
      new Request("http://localhost/api/admin/members/a/gifts", {
        method: "POST",
        body: JSON.stringify({ giftId: ids.giftB }),
      }),
      { params: Promise.resolve({ userId: ids.userA }) },
    );
    expect(response.status).toBe(404);
  });

  it("一括付与APIでも店舗Bのギフトを店舗Aの会員へ付与できない", async () => {
    const response = await issueGift(
      new Request("http://localhost/api/admin/user-gifts/issue", {
        method: "POST",
        body: JSON.stringify({ userId: ids.userA, giftId: ids.giftB }),
      }),
    );
    expect(response.status).toBe(404);
  });

  it("店舗Bのギフトを直接更新できない", async () => {
    const response = await updateGift(
      new Request("http://localhost/api/admin/gifts/b", {
        method: "PATCH",
        body: JSON.stringify({
          title: "改ざん",
          usageGuide: "改ざん",
          expiryType: "DAYS_AFTER_ISSUE",
          expiryDays: 30,
          imagePath: "https://example.com/tampered.png",
        }),
      }),
      { params: Promise.resolve({ giftId: ids.giftB }) },
    );
    expect(response.status).toBe(404);
  });

  it("店舗Bの会員権限を変更できない", async () => {
    const response = await updateMemberRole(
      new Request("http://localhost/api/admin/members/b/role", {
        method: "PATCH",
        body: JSON.stringify({ role: "staff" }),
      }),
      { params: Promise.resolve({ userId: ids.userB }) },
    );
    expect(response.status).toBe(404);
  });

  it("LINE配信対象件数に店舗Bの会員を含めない", async () => {
    const response = await countDeliveryTargets(
      new Request("http://localhost/api/admin/spot-delivery/targets/count", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    const body = (await response.json()) as { count: number };
    expect(response.status).toBe(200);
    expect(body.count).toBe(1);
  });
});
