import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { requireLiffUser } from "@/lib/liff-auth";

function contextWithToken(token?: string) {
  return {
    request: new Request("http://localhost/api/rpc", {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    }),
  };
}

describe("LIFF user authentication", () => {
  const originalMockLiff = process.env.NEXT_PUBLIC_DEV_MOCK_LIFF;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEV_MOCK_LIFF = "true";
  });

  afterEach(() => {
    if (originalMockLiff === undefined) {
      delete process.env.NEXT_PUBLIC_DEV_MOCK_LIFF;
    } else {
      process.env.NEXT_PUBLIC_DEV_MOCK_LIFF = originalMockLiff;
    }
  });

  it("rejects a request without an ID token", async () => {
    await expect(
      requireLiffUser({
        context: contextWithToken(),
        userId: "user-a",
        storeSlug: "store-a",
      }),
    ).rejects.toThrow("LINE認証が必要です");
  });

  it("rejects a token issued for another user", async () => {
    await expect(
      requireLiffUser({
        context: contextWithToken("dev-mock:user-b:store-a"),
        userId: "user-a",
        storeSlug: "store-a",
      }),
    ).rejects.toThrow("認証情報が一致しません");
  });

  it("rejects a token issued for another tenant", async () => {
    await expect(
      requireLiffUser({
        context: contextWithToken("dev-mock:user-a:store-b"),
        userId: "user-a",
        storeSlug: "store-a",
      }),
    ).rejects.toThrow("認証情報が一致しません");
  });

  it("accepts a token matching both user and tenant", async () => {
    await expect(
      requireLiffUser({
        context: contextWithToken("dev-mock:user-a:store-a"),
        userId: "user-a",
        storeSlug: "store-a",
      }),
    ).resolves.toEqual({ userId: "user-a" });
  });
});
