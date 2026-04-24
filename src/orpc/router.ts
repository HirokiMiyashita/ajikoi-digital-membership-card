import { os } from "@orpc/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

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
        await prisma.user.upsert({
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

        return {
          ok: true,
          provider: "prisma",
        };
      }),
  },
};
