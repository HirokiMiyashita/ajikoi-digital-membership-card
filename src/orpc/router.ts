import { os } from "@orpc/server";
import { z } from "zod";

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
};
