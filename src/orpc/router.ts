import { os } from "@orpc/server";
import { GiftExpiryType, Prisma } from "@prisma/client";
import { z } from "zod";

import { adminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const OFFICIAL_ACCOUNT_CACHE_TTL_MS = 5 * 60 * 1000;
let officialAccountCache: { id: string | null; expiresAt: number } | null = null;

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
  const now = Date.now();
  if (officialAccountCache && officialAccountCache.expiresAt > now) {
    return officialAccountCache.id;
  }

  const lineBasicId = process.env.LINE_OFFICIAL_ACCOUNT_ID?.trim();
  if (!lineBasicId) {
    officialAccountCache = {
      id: null,
      expiresAt: now + OFFICIAL_ACCOUNT_CACHE_TTL_MS,
    };
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

  const resolvedId = rows[0]?.id ?? null;
  officialAccountCache = {
    id: resolvedId,
    expiresAt: now + OFFICIAL_ACCOUNT_CACHE_TTL_MS,
  };
  return resolvedId;
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

type LatestDeliveryRow = {
  sentAt: Date;
  message: string;
  sent: number;
  failed: number;
  aggregationUnit: string | null;
};

type LatestDeliveryVisitRow = {
  visits: number;
};

function formatJstYmd(date: Date) {
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const jst = new Date(date.getTime() + jstOffsetMs);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

async function getLineUniqueImpressionByAggregationUnit(
  aggregationUnit: string,
  sentAt: Date,
): Promise<number | null> {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    return null;
  }

  const from = formatJstYmd(sentAt);
  const toDate = new Date();
  const maxToDate = new Date(sentAt);
  maxToDate.setDate(maxToDate.getDate() + 30);
  const to = formatJstYmd(toDate <= maxToDate ? toDate : maxToDate);

  const url = new URL("https://api.line.me/v2/bot/insight/message/event/aggregation");
  url.searchParams.set("customAggregationUnit", aggregationUnit);
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    if (!response.ok) {
      return null;
    }
    const json = (await response.json()) as {
      overview?: {
        uniqueImpression?: number | null;
      };
    };
    return json.overview?.uniqueImpression ?? null;
  } catch {
    return null;
  }
}

async function getAdminReportMetrics(officialAccountId: string | null) {
  const officialAccountFilterUsers = officialAccountId
    ? Prisma.sql`AND u."officialAccountId" = ${officialAccountId}`
    : Prisma.empty;
  const officialAccountFilterCheckins = officialAccountId
    ? Prisma.sql`AND c."officialAccountId" = ${officialAccountId}`
    : Prisma.empty;

  const memberTrendPromise = prisma.$queryRaw<MemberTrendRow[]>`
    WITH daily_new_members AS (
      SELECT
        u."createdAt"::date AS day,
        COUNT(*)::int AS new_members
      FROM "users" u
      WHERE 1 = 1
      ${officialAccountFilterUsers}
      GROUP BY u."createdAt"::date
    ),
    bounds AS (
      SELECT COALESCE(MIN(day), CURRENT_DATE) AS start_day
      FROM daily_new_members
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
      SUM(COALESCE(dnm.new_members, 0)) OVER (ORDER BY d.day)::int AS "members"
    FROM days d
    LEFT JOIN daily_new_members dnm ON dnm.day = d.day
    ORDER BY d.day ASC
  `;

  const visitTrendPromise = prisma.$queryRaw<VisitTrendRow[]>`
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

  const repeaterTrendPromise = prisma.$queryRaw<RepeaterTrendRow[]>`
    WITH eligible_users AS (
      SELECT u."userId", u."createdAt"::date AS created_day
      FROM "users" u
      WHERE 1 = 1
      ${officialAccountFilterUsers}
    ),
    second_visits AS (
      SELECT
        ranked."userId",
        ranked."checkedInAt"::date AS second_day
      FROM (
        SELECT
          c."userId",
          c."checkedInAt",
          ROW_NUMBER() OVER (PARTITION BY c."userId" ORDER BY c."checkedInAt" ASC) AS rn
        FROM "user_checkins" c
        JOIN eligible_users eu ON eu."userId" = c."userId"
        WHERE 1 = 1
        ${officialAccountFilterCheckins}
      ) ranked
      WHERE ranked.rn = 2
    ),
    daily_repeaters AS (
      SELECT sv.second_day AS day, COUNT(*)::int AS repeater_count
      FROM second_visits sv
      GROUP BY sv.second_day
    ),
    bounds AS (
      SELECT COALESCE(MIN(eu.created_day), CURRENT_DATE) AS start_day
      FROM eligible_users eu
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
      SUM(COALESCE(dr.repeater_count, 0)) OVER (ORDER BY d.day)::int AS "repeaters"
    FROM days d
    LEFT JOIN daily_repeaters dr ON dr.day = d.day
    ORDER BY d.day ASC
  `;

  const repeaterSummaryRowsPromise = prisma.$queryRaw<RepeaterSummary[]>`
    WITH eligible_users AS (
      SELECT u."userId"
      FROM "users" u
      WHERE 1 = 1
      ${officialAccountFilterUsers}
    ),
    user_visit_counts AS (
      SELECT
        eu."userId",
        COUNT(c.*)::int AS visit_count
      FROM eligible_users eu
      LEFT JOIN "user_checkins" c
        ON c."userId" = eu."userId"
        ${officialAccountId ? Prisma.sql`AND c."officialAccountId" = ${officialAccountId}` : Prisma.empty}
      GROUP BY eu."userId"
    ),
    summary AS (
      SELECT
        COUNT(*)::int AS members,
        COUNT(*) FILTER (WHERE uvc.visit_count >= 2)::int AS repeaters
      FROM user_visit_counts uvc
    )
    SELECT
      s.members AS "members",
      s.repeaters AS "repeaters",
      COALESCE(ROUND((s.repeaters::numeric / NULLIF(s.members, 0)::numeric) * 100, 2), 0)::float AS "repeatRate"
    FROM summary s
  `;

  const visitCountDistributionRowsPromise = prisma.$queryRaw<VisitCountDistributionRow[]>`
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

  const ageDistributionRowsPromise = prisma.$queryRaw<AgeDistributionRow[]>`
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

  const genderDistributionRowsPromise = prisma.$queryRaw<GenderDistributionRow[]>`
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

  const revisitFrequencyRowsPromise = prisma.$queryRaw<RevisitFrequencyRow[]>`
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

  const latestDeliveryRowsPromise = prisma.$queryRaw<LatestDeliveryRow[]>`
    SELECT
      h."createdAt" AS "sentAt",
      COALESCE(h."metadata"->>'message', '') AS "message",
      COALESCE((h."metadata"->>'sent')::int, 0) AS "sent",
      COALESCE((h."metadata"->>'failed')::int, 0) AS "failed",
      (h."metadata"->>'aggregationUnit') AS "aggregationUnit"
    FROM "user_history" h
    WHERE h."action" = 'line_trigger_delivery_executed'
      ${officialAccountId ? Prisma.sql`AND h."officialAccountId" = ${officialAccountId}` : Prisma.empty}
    ORDER BY h."createdAt" DESC
    LIMIT 1
  `;

  const [
    memberTrend,
    visitTrend,
    repeaterTrend,
    repeaterSummaryRows,
    visitCountDistributionRows,
    ageDistributionRows,
    genderDistributionRows,
    revisitFrequencyRows,
    latestDeliveryRows,
  ] = await Promise.all([
    memberTrendPromise,
    visitTrendPromise,
    repeaterTrendPromise,
    repeaterSummaryRowsPromise,
    visitCountDistributionRowsPromise,
    ageDistributionRowsPromise,
    genderDistributionRowsPromise,
    revisitFrequencyRowsPromise,
    latestDeliveryRowsPromise,
  ]);

  const latestDelivery = latestDeliveryRows[0];
  let latestDeliveryVisits = 0;
  let latestDeliveryOpened: number | null = null;
  if (latestDelivery) {
    const latestDeliveryVisitRows = await prisma.$queryRaw<LatestDeliveryVisitRow[]>`
      SELECT COUNT(*)::int AS "visits"
      FROM "user_checkins" c
      WHERE c."checkedInAt" >= ${latestDelivery.sentAt}
      ${officialAccountId ? Prisma.sql`AND c."officialAccountId" = ${officialAccountId}` : Prisma.empty}
    `;
    latestDeliveryVisits = latestDeliveryVisitRows[0]?.visits ?? 0;
    if (latestDelivery.aggregationUnit) {
      latestDeliveryOpened = await getLineUniqueImpressionByAggregationUnit(
        latestDelivery.aggregationUnit,
        latestDelivery.sentAt,
      );
    }
  }

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
    latestDelivery: latestDelivery
      ? {
          sentAt: latestDelivery.sentAt,
          message: latestDelivery.message,
          sent: latestDelivery.sent,
          opened: latestDeliveryOpened,
          visits: latestDeliveryVisits,
          statusLabel: "確定",
        }
      : null,
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
            officialAccountId: officialAccountId ?? undefined,
            officialLinkedAt: officialAccountId ? new Date() : undefined,
          },
          update: {
            displayName: input.displayName,
            ...(officialAccountId
              ? {
                  officialAccountId,
                  officialLinkedAt: new Date(),
                }
              : {}),
          },
        });

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
        const checkedInToday = isCheckedInToday(user.lastCheckInAt);

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
    listOwnedGifts: os
      .input(
        z.object({
          userId: z.string().min(1),
        }),
      )
      .handler(async ({ input }) => {
        const now = new Date();
        const gifts = await prisma.userGift.findMany({
          where: {
            userId: input.userId,
            isUsed: false,
            expiresAt: {
              gte: now,
            },
          },
          orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            expiresAt: true,
            gift: {
              select: {
                id: true,
                title: true,
                usageGuide: true,
                imageUrl: true,
              },
            },
          },
        });

        return {
          ok: true,
          gifts: gifts.map((row) => ({
            userGiftId: row.id,
            giftId: row.gift.id,
            title: row.gift.title,
            usageGuide: row.gift.usageGuide,
            imageUrl: row.gift.imageUrl,
            expiresAt: row.expiresAt.toISOString(),
          })),
        };
      }),
    useGift: os
      .input(
        z.object({
          userId: z.string().min(1),
          userGiftId: z.string().min(1),
        }),
      )
      .handler(async ({ input }) => {
        const now = new Date();
        const updated = await prisma.userGift.updateMany({
          where: {
            id: input.userGiftId,
            userId: input.userId,
            isUsed: false,
            expiresAt: {
              gte: now,
            },
          },
          data: {
            isUsed: true,
            usedAt: now,
          },
        });

        if (updated.count === 0) {
          throw new Error("特典の利用に失敗しました。期限切れまたは利用済みの可能性があります。");
        }

        return {
          ok: true,
          userGiftId: input.userGiftId,
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
          latestDelivery: metrics.latestDelivery
            ? {
                ...metrics.latestDelivery,
                sentAt: metrics.latestDelivery.sentAt.toISOString(),
              }
            : null,
        };
      }),
  },
};
