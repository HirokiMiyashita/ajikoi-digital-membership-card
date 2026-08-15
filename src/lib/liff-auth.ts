import { prisma } from "@/lib/prisma";

type LineIdTokenPayload = {
  sub?: string;
  aud?: string;
  exp?: number;
};

const verifiedTokenCache = new Map<
  string,
  { userId: string; channelId: string; expiresAt: number }
>();

function requestFromContext(context: unknown) {
  return (context as { request?: Request } | undefined)?.request ?? null;
}

function getBearerToken(request: Request | null) {
  const authorization = request?.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
}

function channelIdFromLiffId(liffId: string) {
  return liffId.split("-")[0]?.trim() ?? "";
}

async function getStoreLiffId(storeSlug?: string, userId?: string) {
  if (storeSlug) {
    const store = await prisma.officialAccount.findUnique({
      where: { slug: storeSlug },
      select: { liffId: true },
    });
    return store?.liffId ?? null;
  }
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { userId },
      select: {
        officialAccount: {
          select: { liffId: true },
        },
      },
    });
    return user?.officialAccount?.liffId ?? null;
  }
  return null;
}

export async function requireLiffUser(params: {
  context: unknown;
  userId: string;
  storeSlug?: string;
}) {
  const token = getBearerToken(requestFromContext(params.context));
  if (!token) {
    throw new Error("LINE認証が必要です。");
  }

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DEV_MOCK_LIFF === "true"
  ) {
    const [prefix, userId, storeSlug] = token.split(":");
    if (
      prefix !== "dev-mock" ||
      userId !== params.userId ||
      (params.storeSlug && storeSlug !== params.storeSlug)
    ) {
      throw new Error("開発用LINE認証情報が一致しません。");
    }
    return { userId };
  }

  const liffId = await getStoreLiffId(params.storeSlug, params.userId);
  const channelId = liffId ? channelIdFromLiffId(liffId) : "";
  if (!channelId) {
    throw new Error("店舗のLIFF IDが設定されていません。");
  }

  const cached = verifiedTokenCache.get(token);
  if (
    cached &&
    cached.expiresAt > Date.now() &&
    cached.userId === params.userId &&
    cached.channelId === channelId
  ) {
    return { userId: cached.userId };
  }

  const body = new URLSearchParams({ id_token: token, client_id: channelId });
  const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("LINE認証の検証に失敗しました。");
  }
  const payload = (await response.json()) as LineIdTokenPayload;
  if (payload.sub !== params.userId || payload.aud !== channelId) {
    throw new Error("LINEユーザー情報が一致しません。");
  }

  verifiedTokenCache.set(token, {
    userId: payload.sub,
    channelId,
    expiresAt: Math.min((payload.exp ?? 0) * 1000, Date.now() + 5 * 60 * 1000),
  });
  return { userId: payload.sub };
}
