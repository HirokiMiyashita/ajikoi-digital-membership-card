import { os } from "@orpc/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

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

        return {
          ok: true,
          provider: "prisma",
          points: user.points,
          nextRank: user.nextRank,
          currentRankName: currentRank.name,
          nextRankName: nextRank?.name ?? null,
          pointsToNextRank: nextRank ? Math.max(nextRank.minPoints - user.points, 0) : 0,
        };
      }),
  },
};
