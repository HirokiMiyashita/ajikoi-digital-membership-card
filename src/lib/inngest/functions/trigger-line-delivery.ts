import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const triggerLineDeliveryPayloadSchema = z.object({
  title: z.string().optional().default(""),
  notificationText: z.string().optional().default(""),
  messages: z
    .array(
      z.union([
        z.object({
          type: z.literal("text"),
          text: z.string().min(1),
        }),
        z.object({
          type: z.literal("image"),
          originalContentUrl: z.string().url(),
          previewImageUrl: z.string().url(),
        }),
        z.object({
          type: z.literal("flex"),
          altText: z.string().min(1),
          contents: z.record(z.string(), z.unknown()),
        }),
      ]),
    )
    .min(1),
  officialAccountId: z.string().nullable(),
  targetUserIds: z.array(z.string().min(1)).optional().default([]),
  triggeredBy: z.string().min(1),
});

const LINE_PUSH_API_URL = "https://api.line.me/v2/bot/message/push";

function chunkArray<T>(list: T[], chunkSize: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < list.length; i += chunkSize) {
    chunks.push(list.slice(i, i + chunkSize));
  }
  return chunks;
}

function createAggregationUnit() {
  return `spot_${Date.now().toString(36)}`;
}

export const triggerLineDelivery = inngest.createFunction(
  {
    id: "trigger-line-delivery",
    triggers: [{ event: "line/delivery.triggered" }],
  },
  async ({ event, step }) => {
    const { title, notificationText, messages, officialAccountId, targetUserIds, triggeredBy } =
      triggerLineDeliveryPayloadSchema.parse((event as { data: unknown }).data);
    const aggregationUnit = createAggregationUnit();

    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
    if (!accessToken) {
      throw new Error("LINE_CHANNEL_ACCESS_TOKEN が未設定です。");
    }

    const recipients = await step.run("resolve-recipients", async () => {
      if (targetUserIds && targetUserIds.length > 0) {
        return prisma.user.findMany({
          where: {
            userId: { in: targetUserIds },
            ...(officialAccountId ? { officialAccountId } : {}),
          },
          select: { userId: true },
        });
      }
      return prisma.user.findMany({
        where: officialAccountId ? { officialAccountId } : undefined,
        select: { userId: true },
      });
    });

    const userIds = recipients.map((row) => row.userId);
    if (userIds.length === 0) {
      return { ok: true, sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;
    for (const chunk of chunkArray(userIds, 50)) {
      const results = await step.run(`send-line-push-${sent + failed}`, async () => {
        return Promise.allSettled(
          chunk.map(async (to) => {
            const response = await fetch(LINE_PUSH_API_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                to,
                messages,
                customAggregationUnits: [aggregationUnit],
              }),
            });
            if (!response.ok) {
              const text = await response.text();
              throw new Error(`LINE push failed (${response.status}): ${text}`);
            }
          }),
        );
      });

      for (const result of results) {
        if (result.status === "fulfilled") {
          sent += 1;
        } else {
          failed += 1;
        }
      }
    }

    await step.run("insert-history", async () => {
      await prisma.$executeRaw`
        INSERT INTO "user_history"
          ("id", "targetUserId", "actorType", "actorId", "action", "metadata", "officialAccountId", "createdAt")
        VALUES
          (
            md5(random()::text || clock_timestamp()::text),
            ${userIds[0]},
            'admin',
            ${triggeredBy},
            'line_trigger_delivery_executed',
            ${JSON.stringify({
              title,
              notificationText,
              message: notificationText || (messages.find((m) => m.type === "text")?.text ?? ""),
              messages,
              sent,
              failed,
              aggregationUnit,
            })}::jsonb,
            ${officialAccountId},
            NOW()
          )
      `;
    });

    return { ok: true, sent, failed };
  },
);
