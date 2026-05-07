import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { type AdminUser } from "@prisma/client";

import { adminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const ADMIN_USER_CACHE_TTL_MS = 5 * 60 * 1000;
const adminUserCache = new Map<string, { user: AdminUser; expiresAt: number }>();

function extractCookieValues(cookieHeader: string | null) {
  if (!cookieHeader) {
    return [];
  }
  const values: string[] = [];
  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const rawValue = pair.slice(separator + 1).trim().replace(/^"|"$/g, "");
    if (!rawValue) {
      continue;
    }
    try {
      values.push(decodeURIComponent(rawValue));
    } catch {
      values.push(rawValue);
    }
  }
  return [...new Set(values)];
}

export async function requireAdminUser() {
  const startedAt = Date.now();
  const requestHeaders = await headers();
  const headersResolvedAt = Date.now();
  let adminId: string | null = null;
  const tokenCandidates = extractCookieValues(requestHeaders.get("cookie"));
  if (tokenCandidates.length > 0) {
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
    adminId = fastSession?.user?.username ?? null;
  }
  let sessionResolvedAt = Date.now();
  let usedFastPath = Boolean(adminId);
  if (!adminId) {
    const session = await adminAuth.api.getSession({
      headers: requestHeaders,
    });
    sessionResolvedAt = Date.now();
    adminId = session?.user?.username ?? null;
    usedFastPath = false;
  }

  if (!adminId) {
    redirect("/admin/login");
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
        sessionMode: usedFastPath ? "cookie-db" : "better-auth",
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
      sessionMode: usedFastPath ? "cookie-db" : "better-auth",
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
