import { os } from "@orpc/server";
import { GiftExpiryType, Prisma } from "@prisma/client";
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

function addDays(base: Date, days: number) {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return date;
}

type VisitGachaResult = {
  executed: boolean;
  won: boolean;
  winProbability: number;
  giftTitle: string | null;
};

async function runVisitGacha(userId: string, officialAccountId: string | null): Promise<VisitGachaResult> {
  const scopeKey = officialAccountId ?? "global";
  const setting = await prisma.visitGachaSetting.findUnique({
    where: { scopeKey },
    select: {
      giftId: true,
      winProbability: true,
      isActive: true,
      gift: {
        select: {
          id: true,
          title: true,
          expiryType: true,
          expiryDays: true,
          expiryAt: true,
        },
      },
    },
  });

  if (!setting || !setting.isActive) {
    return {
      executed: false,
      won: false,
      winProbability: 0,
      giftTitle: null,
    };
  }

  const winProbability = Math.max(0, Math.min(100, setting.winProbability));
  const won = Math.random() * 100 < winProbability;

  if (!won) {
    return {
      executed: true,
      won: false,
      winProbability,
      giftTitle: null,
    };
  }

  const gift = setting.gift;
  if (!gift) {
    return {
      executed: true,
      won: false,
      winProbability,
      giftTitle: null,
    };
  }

  const now = new Date();
  let expiresAt: Date | null = null;
  if (gift.expiryType === GiftExpiryType.DAYS_AFTER_ISSUE) {
    const days = gift.expiryDays ?? 0;
    if (days > 0) {
      expiresAt = addDays(now, days);
    }
  } else if (gift.expiryAt) {
    expiresAt = gift.expiryAt;
  }

  if (!expiresAt) {
    return {
      executed: true,
      won: false,
      winProbability,
      giftTitle: null,
    };
  }

  await prisma.userGift.create({
    data: {
      userId,
      giftId: gift.id,
      expiresAt,
    },
  });

  return {
    executed: true,
    won: true,
    winProbability,
    giftTitle: gift.title,
  };
}

type MemberTrendRow = {
  day: Date;
  members: number;
};

type RepeaterTrendRow = {
  day: Date;
  repeaters: number;
};

type VisitTrendRow = {
  day: Date;
  newVisits: number;
  repeatVisits: number;
  totalVisits: number;
};

type RepeaterSummary = {
  members: number;
  repeaters: number;
  repeatRate: number;
};

type VisitCountDistributionRow = {
  label: string;
  count: number;
  sortOrder: number;
};

type AgeDistributionRow = {
  label: string;
  count: number;
  sortOrder: number;
};

type GenderDistributionRow = {
  label: string;
  count: number;
  sortOrder: number;
};

type RevisitFrequencyRow = {
  usersCount: number;
  avgVisitsIn30Days: number;
};

async function getAdminReportMetrics(officialAccountId: string | null) {
  const officialAccountFilterUsers = officialAccountId
    ? Prisma.sql`AND u."officialAccountId" = ${officialAccountId}`
    : Prisma.empty;
  const officialAccountFilterUsersNoAlias = officialAccountId
    ? Prisma.sql`AND "officialAccountId" = ${officialAccountId}`
    : Prisma.empty;
  const officialAccountFilterCheckins = officialAccountId
    ? Prisma.sql`AND c."officialAccountId" = ${officialAccountId}`
    : Prisma.empty;

  const memberTrend = await prisma.$queryRaw<MemberTrendRow[]>`
    WITH bounds AS (
      SELECT COALESCE(MIN(u."createdAt")::date, CURRENT_DATE) AS start_day
      FROM "users" u
      WHERE 1 = 1
      ${officialAccountFilterUsers}
    ),
    days AS (
      SELECT generate_series(
        (SELECT start_day FROM bounds),
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
    WITH bounds AS (
      SELECT COALESCE(MIN(c."checkedInAt")::date, CURRENT_DATE) AS start_day
      FROM "user_checkins" c
      WHERE 1 = 1
      ${officialAccountFilterCheckins}
    ),
    days AS (
      SELECT generate_series(
        (SELECT start_day FROM bounds),
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

  const repeaterTrend = await prisma.$queryRaw<RepeaterTrendRow[]>`
    WITH bounds AS (
      SELECT COALESCE(MIN(u."createdAt")::date, CURRENT_DATE) AS start_day
      FROM "users" u
      WHERE 1 = 1
      ${officialAccountFilterUsers}
    ),
    days AS (
      SELECT generate_series(
        (SELECT start_day FROM bounds),
        CURRENT_DATE::date,
        INTERVAL '1 day'
      )::date AS day
    )
    SELECT
      d.day AS "day",
      (
        SELECT COUNT(*)::int
        FROM (
          SELECT u."userId"
          FROM "users" u
          LEFT JOIN "user_checkins" c
            ON c."userId" = u."userId"
            AND c."checkedInAt" < d.day + INTERVAL '1 day'
            ${officialAccountId ? Prisma.sql`AND c."officialAccountId" = ${officialAccountId}` : Prisma.empty}
          WHERE u."createdAt" < d.day + INTERVAL '1 day'
          ${officialAccountFilterUsers}
          GROUP BY u."userId"
          HAVING COUNT(c.*) >= 2
        ) r
      ) AS "repeaters"
    FROM days d
    ORDER BY d.day ASC
  `;

  const repeaterSummaryRows = await prisma.$queryRaw<RepeaterSummary[]>`
    SELECT
      COUNT(u."userId")::int AS "members",
      COALESCE(
        SUM(
          CASE
            WHEN (
              SELECT COUNT(*)::int
              FROM "user_checkins" c
              WHERE c."userId" = u."userId"
              ${officialAccountId ? Prisma.sql`AND c."officialAccountId" = ${officialAccountId}` : Prisma.empty}
            ) >= 2 THEN 1 ELSE 0
          END
        ),
        0
      )::int AS "repeaters",
      COALESCE(
        ROUND(
          (
            SUM(
              CASE
                WHEN (
                  SELECT COUNT(*)::int
                  FROM "user_checkins" c
                  WHERE c."userId" = u."userId"
                  ${officialAccountId ? Prisma.sql`AND c."officialAccountId" = ${officialAccountId}` : Prisma.empty}
                ) >= 2 THEN 1 ELSE 0
              END
            )::numeric
            / NULLIF(COUNT(u."userId"), 0)::numeric
          ) * 100,
          2
        ),
        0
      )::float AS "repeatRate"
    FROM "users" u
    WHERE 1 = 1
    ${officialAccountFilterUsersNoAlias}
  `;

  const visitCountDistributionRows = await prisma.$queryRaw<VisitCountDistributionRow[]>`
    WITH visits_per_user AS (
      SELECT
        u."userId",
        COALESCE(COUNT(c.*), 0)::int AS visits
      FROM "users" u
      LEFT JOIN "user_checkins" c
        ON c."userId" = u."userId"
        ${officialAccountId ? Prisma.sql`AND c."officialAccountId" = ${officialAccountId}` : Prisma.empty}
      WHERE 1 = 1
      ${officialAccountFilterUsers}
      GROUP BY u."userId"
    )
    SELECT * FROM (
      SELECT '1回'::text AS "label", COUNT(*) FILTER (WHERE visits = 1)::int AS "count", 1::int AS "sortOrder" FROM visits_per_user
      UNION ALL
      SELECT '2回'::text AS "label", COUNT(*) FILTER (WHERE visits = 2)::int AS "count", 2::int AS "sortOrder" FROM visits_per_user
      UNION ALL
      SELECT '3回'::text AS "label", COUNT(*) FILTER (WHERE visits = 3)::int AS "count", 3::int AS "sortOrder" FROM visits_per_user
      UNION ALL
      SELECT '4回'::text AS "label", COUNT(*) FILTER (WHERE visits = 4)::int AS "count", 4::int AS "sortOrder" FROM visits_per_user
      UNION ALL
      SELECT '5回〜'::text AS "label", COUNT(*) FILTER (WHERE visits >= 5)::int AS "count", 5::int AS "sortOrder" FROM visits_per_user
    ) t
    ORDER BY t."sortOrder" ASC
  `;

  const ageDistributionRows = await prisma.$queryRaw<AgeDistributionRow[]>`
    WITH surveyed AS (
      SELECT
        CASE
          WHEN DATE_PART('year', AGE(CURRENT_DATE, s."birthDate")) BETWEEN 10 AND 19 THEN '10代'
          WHEN DATE_PART('year', AGE(CURRENT_DATE, s."birthDate")) BETWEEN 20 AND 29 THEN '20代'
          WHEN DATE_PART('year', AGE(CURRENT_DATE, s."birthDate")) BETWEEN 30 AND 39 THEN '30代'
          WHEN DATE_PART('year', AGE(CURRENT_DATE, s."birthDate")) BETWEEN 40 AND 49 THEN '40代'
          WHEN DATE_PART('year', AGE(CURRENT_DATE, s."birthDate")) BETWEEN 50 AND 59 THEN '50代'
          WHEN DATE_PART('year', AGE(CURRENT_DATE, s."birthDate")) >= 60 THEN '60代〜'
          ELSE 'その他'
        END AS age_band
      FROM "users" u
      JOIN "user_surveys" s ON s."id" = u."surveyId"
      WHERE 1 = 1
      ${officialAccountFilterUsers}
    )
    SELECT * FROM (
      SELECT '10代'::text AS "label", COUNT(*) FILTER (WHERE age_band = '10代')::int AS "count", 1::int AS "sortOrder" FROM surveyed
      UNION ALL
      SELECT '20代'::text AS "label", COUNT(*) FILTER (WHERE age_band = '20代')::int AS "count", 2::int AS "sortOrder" FROM surveyed
      UNION ALL
      SELECT '30代'::text AS "label", COUNT(*) FILTER (WHERE age_band = '30代')::int AS "count", 3::int AS "sortOrder" FROM surveyed
      UNION ALL
      SELECT '40代'::text AS "label", COUNT(*) FILTER (WHERE age_band = '40代')::int AS "count", 4::int AS "sortOrder" FROM surveyed
      UNION ALL
      SELECT '50代'::text AS "label", COUNT(*) FILTER (WHERE age_band = '50代')::int AS "count", 5::int AS "sortOrder" FROM surveyed
      UNION ALL
      SELECT '60代〜'::text AS "label", COUNT(*) FILTER (WHERE age_band = '60代〜')::int AS "count", 6::int AS "sortOrder" FROM surveyed
      UNION ALL
      SELECT 'その他'::text AS "label", COUNT(*) FILTER (WHERE age_band = 'その他')::int AS "count", 7::int AS "sortOrder" FROM surveyed
    ) t
    ORDER BY t."sortOrder" ASC
  `;

  const genderDistributionRows = await prisma.$queryRaw<GenderDistributionRow[]>`
    WITH surveyed AS (
      SELECT
        CASE
          WHEN s."gender" = 'male' THEN '男性'
          WHEN s."gender" = 'female' THEN '女性'
          ELSE 'その他'
        END AS gender_label
      FROM "users" u
      JOIN "user_surveys" s ON s."id" = u."surveyId"
      WHERE 1 = 1
      ${officialAccountFilterUsers}
    )
    SELECT * FROM (
      SELECT '女性'::text AS "label", COUNT(*) FILTER (WHERE gender_label = '女性')::int AS "count", 1::int AS "sortOrder" FROM surveyed
      UNION ALL
      SELECT '男性'::text AS "label", COUNT(*) FILTER (WHERE gender_label = '男性')::int AS "count", 2::int AS "sortOrder" FROM surveyed
      UNION ALL
      SELECT 'その他'::text AS "label", COUNT(*) FILTER (WHERE gender_label = 'その他')::int AS "count", 3::int AS "sortOrder" FROM surveyed
    ) t
    ORDER BY t."sortOrder" ASC
  `;

  const revisitFrequencyRows = await prisma.$queryRaw<RevisitFrequencyRow[]>`
    WITH first_checkins AS (
      SELECT c."userId", MIN(c."checkedInAt") AS first_at
      FROM "user_checkins" c
      WHERE 1 = 1
      ${officialAccountFilterCheckins}
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
      COALESCE(ROUND(AVG(v.visits)::numeric, 2), 0)::float AS "avgVisitsIn30Days"
    FROM visits_30d v
  `;

  return {
    memberTrend,
    repeaterTrend,
    visitTrend,
    repeaterSummary: repeaterSummaryRows[0] ?? {
      members: 0,
      repeaters: 0,
      repeatRate: 0,
    },
    visitCountDistribution: visitCountDistributionRows.map((row) => ({
      label: row.label,
      count: row.count,
    })),
    ageDistribution: ageDistributionRows.map((row) => ({
      label: row.label,
      count: row.count,
    })),
    genderDistribution: genderDistributionRows.map((row) => ({
      label: row.label,
      count: row.count,
    })),
    revisitFrequency: revisitFrequencyRows[0] ?? {
      usersCount: 0,
      avgVisitsIn30Days: 0,
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
          hasSurvey: Boolean(user.surveyId),
        };
      }),
    submitOnboardingSurvey: os
      .input(
        z.object({
          userId: z.string().min(1),
          gender: z.enum(["male", "female", "other"]),
          visitFrequency: z.enum(["1", "2", "3", "4", "5_plus"]),
          companionType: z.enum(["alone", "family", "partner_or_friends", "coworkers", "other"]),
          birthDate: z.string().min(1),
        }),
      )
      .handler(async ({ input }) => {
        const parsedBirthDate = new Date(input.birthDate);
        if (Number.isNaN(parsedBirthDate.getTime())) {
          throw new Error("生年月日の形式が不正です。");
        }

        const existingUser = await prisma.user.findUnique({
          where: { userId: input.userId },
          select: { surveyId: true },
        });
        if (!existingUser) {
          throw new Error("ユーザーが見つかりません。");
        }

        let surveyId = existingUser.surveyId;
        if (surveyId) {
          await prisma.userSurvey.update({
            where: { id: surveyId },
            data: {
              gender: input.gender,
              visitFrequency: input.visitFrequency,
              companionType: input.companionType,
              birthDate: parsedBirthDate,
            },
          });
        } else {
          const created = await prisma.userSurvey.create({
            data: {
              gender: input.gender,
              visitFrequency: input.visitFrequency,
              companionType: input.companionType,
              birthDate: parsedBirthDate,
            },
          });
          surveyId = created.id;
          await prisma.user.update({
            where: { userId: input.userId },
            data: { surveyId },
          });
        }

        return {
          ok: true,
          surveyId,
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

        const gacha = await runVisitGacha(updatedUser.userId, officialAccountId);
        if (gacha.executed) {
          await prisma.$executeRaw`
            INSERT INTO "user_history"
              ("id", "targetUserId", "actorType", "actorId", "action", "metadata", "officialAccountId", "createdAt")
            VALUES
              (
                md5(random()::text || clock_timestamp()::text),
                ${updatedUser.userId},
                'system',
                'visit_gacha',
                ${gacha.won ? "visit_gacha_won" : "visit_gacha_lost"},
                ${JSON.stringify({
                  winProbability: gacha.winProbability,
                  giftTitle: gacha.giftTitle,
                })}::jsonb,
                ${officialAccountId},
                NOW()
              )
          `;
        }

        return {
          ok: true,
          points: updatedUser.points,
          currentRankName: currentRank.name,
          nextRankName: nextRank?.name ?? null,
          pointsToNextRank: nextRank ? Math.max(nextRank.minPoints - updatedUser.points, 0) : 0,
          checkedInToday: true,
          gacha,
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
          repeaterTrend: metrics.repeaterTrend.map((row) => ({
            day: row.day.toISOString(),
            repeaters: row.repeaters,
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
