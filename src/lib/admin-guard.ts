import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { type AdminUser } from "@prisma/client";
import { createHash } from "node:crypto";

import { adminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const ADMIN_USER_CACHE_TTL_MS = 5 * 60 * 1000;
const adminUserCache = new Map<string, { user: AdminUser; expiresAt: number }>();
const ADMIN_SESSION_CACHE_TTL_MS = 60 * 1000;
const adminSessionCache = new Map<string, { adminId: string; expiresAt: number }>();

function parseCookieEntries(cookieHeader: string | null) {
  if (!cookieHeader) return [] as Array<{ name: string; value: string }>;
  const entries: Array<{ name: string; value: string }> = [];
  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    const name = pair.slice(0, separator).trim();
    const rawValue = pair.slice(separator + 1).trim().replace(/^"|"$/g, "");
    if (!name || !rawValue) continue;
    try {
      entries.push({ name, value: decodeURIComponent(rawValue) });
    } catch {
      entries.push({ name, value: rawValue });
    }
  }
  return entries;
}

function getSessionTokenCandidates(cookieHeader: string | null) {
  const cookieEntries = parseCookieEntries(cookieHeader);
  const likelySessionEntries = cookieEntries.filter((entry) => /auth|session|token/i.test(entry.name));
  const baseValues = likelySessionEntries.length > 0
    ? likelySessionEntries.map((entry) => entry.value)
    : cookieEntries.map((entry) => entry.value);
  const candidates = new Set<string>();
  for (const value of baseValues) {
    if (!value) continue;
    candidates.add(value);
    const dotIndex = value.indexOf(".");
    if (dotIndex > 0) {
      candidates.add(value.slice(0, dotIndex));
    }
  }
  for (const value of [...candidates]) {
    candidates.add(createHash("sha256").update(value).digest("hex"));
  }
  const cacheKeyBase = [...candidates].sort().join("|");
  return {
    tokenCandidates: [...candidates],
    sessionCacheKey: cacheKeyBase ? createHash("sha1").update(cacheKeyBase).digest("hex") : null,
  };
}

export async function requireAdminUser() {
  const startedAt = Date.now();
  const requestHeaders = await headers();
  const headersResolvedAt = Date.now();
  const cookieHeader = requestHeaders.get("cookie");
  const { tokenCandidates, sessionCacheKey } = getSessionTokenCandidates(cookieHeader);
  let adminId: string | null = null;
  const sessionCached = sessionCacheKey ? adminSessionCache.get(sessionCacheKey) : undefined;
  const hasValidSessionCache = Boolean(sessionCached && sessionCached.expiresAt > Date.now());
  if (hasValidSessionCache && sessionCached) {
    adminId = sessionCached.adminId;
  }
  if (!adminId && tokenCandidates.length > 0) {
    const fastSession = await prisma.adminAuthSession.findFirst({
      where: {
        token: { in: tokenCandidates },
        expiresAt: { gt: new Date() },
      },
      select: {
        user: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        expiresAt: "desc",
      },
    });
    adminId = adminId ?? fastSession?.user?.username ?? null;
  }
  let sessionResolvedAt = Date.now();
  let sessionMode: "cookie-cache" | "cookie-db" | "better-auth" = hasValidSessionCache
    ? "cookie-cache"
    : "cookie-db";
  if (!adminId) {
    const session = await adminAuth.api.getSession({
      headers: requestHeaders,
    });
    sessionResolvedAt = Date.now();
    adminId = session?.user?.username ?? null;
    sessionMode = "better-auth";
  }

  if (!adminId) {
    redirect("/admin/login");
  }
  if (sessionCacheKey) {
    adminSessionCache.set(sessionCacheKey, {
      adminId,
      expiresAt: Date.now() + ADMIN_SESSION_CACHE_TTL_MS,
    });
  }

  const cached = adminUserCache.get(adminId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    const elapsedMs = now - startedAt;
    if (elapsedMs >= 500) {
      console.info("[admin.requireAdminUser-ms]", {
        total: elapsedMs,
        resolveHeaders: headersResolvedAt - startedAt,
        resolveSession: sessionResolvedAt - headersResolvedAt,
        resolveAdminUser: 0,
        sessionMode,
        adminCacheHit: true,
      });
    }
    return cached.user;
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: {
      id: adminId,
    },
  });
  const adminResolvedAt = Date.now();

  if (!adminUser) {
    redirect("/admin/login?error=not-allowed");
  }

  const elapsedMs = adminResolvedAt - startedAt;
  if (elapsedMs >= 500) {
    console.info("[admin.requireAdminUser-ms]", {
      total: elapsedMs,
      resolveHeaders: headersResolvedAt - startedAt,
      resolveSession: sessionResolvedAt - headersResolvedAt,
      resolveAdminUser: adminResolvedAt - sessionResolvedAt,
      sessionMode,
      adminCacheHit: false,
    });
  }

  adminUserCache.set(adminId, {
    user: adminUser,
    expiresAt: Date.now() + ADMIN_USER_CACHE_TTL_MS,
  });

  return adminUser;
}

export async function getAdminOfficialAccountId(adminId: string) {
  const adminScopeRows = await prisma.$queryRaw<Array<{ officialAccountId: string | null }>>`
    SELECT "officialAccountId"
    FROM "admin_user"
    WHERE "id" = ${adminId}
    LIMIT 1
  `;

  return adminScopeRows[0]?.officialAccountId ?? null;
}
