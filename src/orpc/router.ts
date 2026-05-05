import { os } from "@orpc/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { adminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function matchesVisitQrToken(qrValue: string, expectedToken: string) {
  if (qrValue === expectedToken) {
    return true;
  }

  try {
    const url = new URL(qrValue);
    return url.searchParams.get("token") === expectedToken;
  } catch {
    return false;
  }
}

function getStartOfTodayInJstUtc() {
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const jstNow = new Date(nowMs + jstOffsetMs);
  const startOfJstDayMs =
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) -
    jstOffsetMs;

  return new Date(startOfJstDayMs);
}

function isCheckedInToday(lastCheckInAt: Date | null) {
  if (!lastCheckInAt) {
    return false;
  }

  return lastCheckInAt >= getStartOfTodayInJstUtc();
}

async function resolveOfficialAccountId() {
  const lineBasicId = process.env.LINE_OFFICIAL_ACCOUNT_ID?.trim();
  if (!lineBasicId) {
    return null;
  }

  await prisma.$executeRaw`
    INSERT INTO "official_accounts" ("id", "lineBasicId", "name", "updatedAt")
    VALUES (md5(random()::text || clock_timestamp()::text), ${lineBasicId}, ${lineBasicId}, NOW())
    ON CONFLICT ("lineBasicId")
    DO UPDATE SET "updatedAt" = NOW()
  `;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "official_accounts"
    WHERE "lineBasicId" = ${lineBasicId}
    LIMIT 1
  `;

  return rows[0]?.id ?? null;
}

async function resolveRankByPoints(points: number) {
  const rank = await prisma.rank.findFirst({
    where: {
      minPoints: {
        lte: points,
      },
      maxPoints: {
        gte: points,
      },
    },
    orderBy: {
      minPoints: "asc",
    },
  });

  if (!rank) {
    throw new Error(`No rank found for points: ${points}`);
  }

  return rank;
}

type MemberTrendRow = {
  day: Date;
  members: number;
};

type VisitTrendRow = {
  day: Date;
  newVisits: number;
  repeatVisits: number;
  totalVisits: number;
};

type RevisitFrequency = {
  usersCount: number;
  avgVisitsIn30Days: number;
  totalVisitsIn30Days: number;
};

async function getAdminReportMetrics(officialAccountId: string | null) {
  const officialAccountFilterUsers = officialAccountId
    ? Prisma.sql`AND "officialAccountId" = ${officialAccountId}`
    : Prisma.empty;
  const officialAccountFilterCheckins = officialAccountId
    ? Prisma.sql`AND "officialAccountId" = ${officialAccountId}`
    : Prisma.empty;

  const memberTrend = await prisma.$queryRaw<MemberTrendRow[]>`
    WITH days AS (
      SELECT generate_series(
        (CURRENT_DATE - INTERVAL '13 days')::date,
        CURRENT_DATE::date,
        INTERVAL '1 day'
      )::date AS day
    )
    SELECT
      d.day AS "day",
      (
        SELECT COUNT(*)
        FROM "users" u
        WHERE u."createdAt" < (d.day + INTERVAL '1 day')
        ${officialAccountFilterUsers}
      )::int AS "members"
    FROM days d
    ORDER BY d.day ASC
  `;

  const visitTrend = await prisma.$queryRaw<VisitTrendRow[]>`
    WITH days AS (
      SELECT generate_series(
        (CURRENT_DATE - INTERVAL '13 days')::date,
        CURRENT_DATE::date,
        INTERVAL '1 day'
      )::date AS day
    )
    SELECT
      d.day AS "day",
      COALESCE(SUM(CASE WHEN c."isFirstVisit" THEN 1 ELSE 0 END), 0)::int AS "newVisits",
      COALESCE(SUM(CASE WHEN c."isRepeatVisit" THEN 1 ELSE 0 END), 0)::int AS "repeatVisits",
      COALESCE(COUNT(c.*), 0)::int AS "totalVisits"
    FROM days d
    LEFT JOIN "user_checkins" c
      ON c."checkedInAt" >= d.day
      AND c."checkedInAt" < d.day + INTERVAL '1 day'
      ${officialAccountFilterCheckins}
    GROUP BY d.day
    ORDER BY d.day ASC
  `;

  const revisitFrequencyRows = await prisma.$queryRaw<RevisitFrequency[]>`
    WITH first_checkins AS (
      SELECT c."userId", MIN(c."checkedInAt") AS first_at
      FROM "user_checkins" c
      ${officialAccountId ? Prisma.sql`WHERE c."officialAccountId" = ${officialAccountId}` : Prisma.empty}
      GROUP BY c."userId"
    ),
    revisit_users AS (
      SELECT f."userId", f.first_at
      FROM first_checkins f
      WHERE EXISTS (
        SELECT 1
        FROM "user_checkins" c2
        WHERE c2."userId" = f."userId"
          AND c2."checkedInAt" > f.first_at
          AND c2."checkedInAt" <= f.first_at + INTERVAL '30 days'
          ${officialAccountId ? Prisma.sql`AND c2."officialAccountId" = ${officialAccountId}` : Prisma.empty}
      )
    ),
    visits_30d AS (
      SELECT r."userId", COUNT(*)::int AS visits
      FROM revisit_users r
      JOIN "user_checkins" c ON c."userId" = r."userId"
      WHERE c."checkedInAt" >= r.first_at
        AND c."checkedInAt" <= r.first_at + INTERVAL '30 days'
        ${officialAccountId ? Prisma.sql`AND c."officialAccountId" = ${officialAccountId}` : Prisma.empty}
      GROUP BY r."userId"
    )
    SELECT
      COUNT(*)::int AS "usersCount",
      COALESCE(ROUND(AVG(v.visits)::numeric, 2), 0)::float AS "avgVisitsIn30Days",
      COALESCE(SUM(v.visits), 0)::int AS "totalVisitsIn30Days"
    FROM visits_30d v
  `;

  return {
    memberTrend,
    visitTrend,
    revisitFrequency: revisitFrequencyRows[0] ?? {
      usersCount: 0,
      avgVisitsIn30Days: 0,
      totalVisitsIn30Days: 0,
    },
  };
}

export const appRouter = {
  system: {
    health: os.handler(() => {
      return {
        ok: true,
        message: "oRPC server is running",
        timestamp: new Date().toISOString(),
      };
    }),
    greet: os
      .input(
        z.object({
          name: z.string().min(1).default("ゲスト"),
        }),
      )
      .handler(({ input }) => {
        return {
          message: `こんにちは、${input.name}さん`,
        };
      }),
  },
  user: {
    upsertFromLiff: os
      .input(
        z.object({
          userId: z.string().min(1),
          displayName: z.string().min(1),
        }),
      )
      .handler(async ({ input }) => {
        const officialAccountId = await resolveOfficialAccountId();
        const baseUser = await prisma.user.upsert({
          where: {
            userId: input.userId,
          },
          create: {
            userId: input.userId,
            displayName: input.displayName,
          },
          update: {
            displayName: input.displayName,
          },
        });
        if (officialAccountId) {
          await prisma.$executeRaw`
            UPDATE "users"
            SET "officialAccountId" = ${officialAccountId},
                "officialLinkedAt" = NOW(),
                "updatedAt" = NOW()
            WHERE "userId" = ${input.userId}
          `;
        }

        const currentRank = await resolveRankByPoints(baseUser.points);
        const nextRankId = currentRank.id;
        const user =
          baseUser.nextRank === nextRankId
            ? baseUser
            : await prisma.user.update({
                where: {
                  userId: baseUser.userId,
                },
                data: {
                  nextRank: nextRankId,
                },
              });

        const nextRank = await prisma.rank.findFirst({
          where: {
            minPoints: {
              gt: user.points,
            },
          },
          orderBy: {
            minPoints: "asc",
          },
        });

        const checkInRow = await prisma.$queryRaw<
          Array<{ lastCheckInAt: Date | null }>
        >`SELECT "lastCheckInAt" FROM "users" WHERE "userId" = ${user.userId} LIMIT 1`;
        const checkedInToday = isCheckedInToday(checkInRow[0]?.lastCheckInAt ?? null);

        await prisma.$executeRaw`
          INSERT INTO "user_history"
            ("id", "targetUserId", "actorType", "actorId", "action", "metadata", "officialAccountId", "createdAt")
          VALUES
            (
              md5(random()::text || clock_timestamp()::text),
              ${user.userId},
              'system',
              'liff_sync',
              'user_profile_synced',
              ${JSON.stringify({ displayName: input.displayName })}::jsonb,
              ${officialAccountId},
              NOW()
            )
        `;

        return {
          ok: true,
          provider: "prisma",
          points: user.points,
          nextRank: user.nextRank,
          currentRankName: currentRank.name,
          nextRankName: nextRank?.name ?? null,
          pointsToNextRank: nextRank ? Math.max(nextRank.minPoints - user.points, 0) : 0,
          checkedInToday,
        };
      }),
    addVisitPoint: os
      .input(
        z.object({
          userId: z.string().min(1),
          qrValue: z.string().min(1),
        }),
      )
      .handler(async ({ input }) => {
        const expectedQrToken = process.env.VISIT_QR_TOKEN;
        if (expectedQrToken && !matchesVisitQrToken(input.qrValue.trim(), expectedQrToken)) {
          throw new Error("無効なQRコードです。");
        }

        const startOfTodayInJstUtc = getStartOfTodayInJstUtc();
        const now = new Date();

        const updatedCount = await prisma.$executeRaw`
          UPDATE "users"
          SET "points" = "points" + 1,
              "lastCheckInAt" = ${now}
          WHERE "userId" = ${input.userId}
            AND ("lastCheckInAt" IS NULL OR "lastCheckInAt" < ${startOfTodayInJstUtc})
        `;

        if (Number(updatedCount) === 0) {
          throw new Error("本日の入店ポイントはすでに付与済みです。");
        }

        const updatedUser = await prisma.user.findUnique({
          where: {
            userId: input.userId,
          },
        });

        if (!updatedUser) {
          throw new Error("ユーザーが見つかりません。");
        }

        const currentRank = await resolveRankByPoints(updatedUser.points);
        if (updatedUser.nextRank !== currentRank.id) {
          await prisma.user.update({
            where: {
              userId: updatedUser.userId,
            },
            data: {
              nextRank: currentRank.id,
            },
          });
        }

        const nextRank = await prisma.rank.findFirst({
          where: {
            minPoints: {
              gt: updatedUser.points,
            },
          },
          orderBy: {
            minPoints: "asc",
          },
        });

        const checkInCountRows = await prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS "count"
          FROM "user_checkins"
          WHERE "userId" = ${updatedUser.userId}
        `;
        const checkInCount = checkInCountRows[0]?.count ?? 0;
        const isFirstVisit = checkInCount === 0;
        const userOfficialRows = await prisma.$queryRaw<Array<{ officialAccountId: string | null }>>`
          SELECT "officialAccountId"
          FROM "users"
          WHERE "userId" = ${updatedUser.userId}
          LIMIT 1
        `;
        const officialAccountId = userOfficialRows[0]?.officialAccountId ?? (await resolveOfficialAccountId());

        await prisma.$executeRaw`
          INSERT INTO "user_checkins"
            ("id", "userId", "checkedInAt", "isFirstVisit", "isRepeatVisit", "officialAccountId", "createdAt")
          VALUES
            (
              md5(random()::text || clock_timestamp()::text),
              ${updatedUser.userId},
              ${now},
              ${isFirstVisit},
              ${!isFirstVisit},
              ${officialAccountId},
              NOW()
            )
        `;

        await prisma.$executeRaw`
          INSERT INTO "user_history"
            ("id", "targetUserId", "actorType", "actorId", "action", "metadata", "officialAccountId", "createdAt")
          VALUES
            (
              md5(random()::text || clock_timestamp()::text),
              ${updatedUser.userId},
              'system',
              'checkin_qr',
              'checkin_point_granted',
              ${JSON.stringify({
                qrValue: input.qrValue,
                pointsAfter: updatedUser.points,
                currentRankName: currentRank.name,
              })}::jsonb,
              ${officialAccountId},
              NOW()
            )
        `;

        return {
          ok: true,
          points: updatedUser.points,
          currentRankName: currentRank.name,
          nextRankName: nextRank?.name ?? null,
          pointsToNextRank: nextRank ? Math.max(nextRank.minPoints - updatedUser.points, 0) : 0,
          checkedInToday: true,
        };
      }),
  },
  admin: {
    reportMetrics: os
      .input(z.object({}))
      .handler(async ({ context }) => {
        const request = (context as { request?: Request } | undefined)?.request;
        if (!request) {
          throw new Error("リクエスト情報が見つかりません。");
        }

        const session = await adminAuth.api.getSession({
          headers: request.headers,
        });
        const adminId = session?.user?.username;
        if (!adminId) {
          throw new Error("管理者ログインが必要です。");
        }

        const adminScopeRows = await prisma.$queryRaw<Array<{ officialAccountId: string | null }>>`
          SELECT "officialAccountId"
          FROM "admin_user"
          WHERE "id" = ${adminId}
          LIMIT 1
        `;
        const officialAccountId = adminScopeRows[0]?.officialAccountId ?? null;

        const metrics = await getAdminReportMetrics(officialAccountId);

        return {
          ...metrics,
          memberTrend: metrics.memberTrend.map((row) => ({
            day: row.day.toISOString(),
            members: row.members,
          })),
          visitTrend: metrics.visitTrend.map((row) => ({
            day: row.day.toISOString(),
            newVisits: row.newVisits,
            repeatVisits: row.repeatVisits,
            totalVisits: row.totalVisits,
          })),
        };
      }),
  },
};
