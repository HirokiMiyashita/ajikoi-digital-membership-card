import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/store-crypto";

export const STORE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_SLUGS = new Set(["admin", "api", "auth", "login", "signup", "www"]);

export function normalizeStoreSlug(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export function assertValidStoreSlug(value: string) {
  const slug = normalizeStoreSlug(value);
  if (slug.length < 3 || slug.length > 48 || !STORE_SLUG_PATTERN.test(slug)) {
    throw new Error("店舗URLは3〜48文字の半角英数字とハイフンで入力してください。");
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new Error("この店舗URLは使用できません。");
  }
  return slug;
}

export async function getStoreBySlug(slug: string) {
  return prisma.officialAccount.findUnique({ where: { slug: normalizeStoreSlug(slug) } });
}

export async function getStoreLineAccessToken(officialAccountId: string) {
  return (
    (await getConfiguredStoreLineAccessToken(officialAccountId)) ??
    process.env.LINE_CHANNEL_ACCESS_TOKEN ??
    null
  );
}

export async function getConfiguredStoreLineAccessToken(officialAccountId: string) {
  const store = await prisma.officialAccount.findUnique({
    where: { id: officialAccountId },
    select: { lineChannelAccessToken: true },
  });
  return store?.lineChannelAccessToken
    ? decryptSecret(store.lineChannelAccessToken)
    : null;
}
