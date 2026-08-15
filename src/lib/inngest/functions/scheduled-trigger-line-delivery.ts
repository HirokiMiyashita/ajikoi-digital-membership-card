import { Prisma } from "@prisma/client";

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";

type DeliveryVisitCountSegment = "ZERO" | "ONE" | "TWO_TO_FOUR" | "FIVE_TO_NINE" | "TEN_OR_MORE";

function getNowInJst() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function toJstDateKey(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function resolveVisitCountSegment(checkInCount: number): DeliveryVisitCountSegment {
  if (checkInCount <= 0) return "ZERO";
  if (checkInCount === 1) return "ONE";
  if (checkInCount <= 4) return "TWO_TO_FOUR";
  if (checkInCount <= 9) return "FIVE_TO_NINE";
  return "TEN_OR_MORE";
}

function isValidSendHour(settingHour: number | null, currentJstHour: number) {
  if (settingHour === null) {
    return currentJstHour === 9;
  }
  return settingHour === currentJstHour;
}

export const scheduledTriggerLineDelivery = inngest.createFunction(
  {
    id: "scheduled-trigger-line-delivery",
    triggers: [{ cron: "0 * * * *" }],
  },
  async ({ step }) => {
    const nowJst = getNowInJst();
    const currentJstHour = nowJst.getUTCHours();
    const dateKey = toJstDateKey(nowJst);

    const settings = await step.run("load-scheduled-trigger-settings", async () =>
      prisma.lineDeliveryTriggerSetting.findMany({
        where: {
          isActive: true,
          triggerType: {
            in: ["BIRTHDAY", "GIFT_EXPIRES"],
          },
        },
        select: {
          id: true,
          title: true,
          triggerType: true,
          notificationText: true,
          message: true,
          messages: true,
          officialAccountId: true,
          targetRankIds: true,
          targetGender: true,
          targetVisitCountSegments: true,
          delayDays: true,
          deliveryHourJst: true,
        },
        take: 100,
      }),
    );

    for (const setting of settings) {
      if (!setting.officialAccountId) {
        continue;
      }
      if (!isValidSendHour(setting.deliveryHourJst, currentJstHour)) {
        continue;
      }

      const triggerKey = `system:${setting.triggerType.toLowerCase()}:${setting.id}:${dateKey}`;
      const alreadySentRows = await step.run(`check-already-sent-${setting.id}-${dateKey}`, async () =>
        prisma.userHistory.findFirst({
          where: {
            action: "line_trigger_delivery_executed",
            actorId: triggerKey,
          },
          select: { id: true },
        }),
      );
      if (alreadySentRows?.id) {
        continue;
      }

      const targetDate = new Date(
        Date.UTC(
          nowJst.getUTCFullYear(),
          nowJst.getUTCMonth(),
          nowJst.getUTCDate() - setting.delayDays,
          0,
          0,
          0,
          0,
        ),
      );
      const month = targetDate.getUTCMonth() + 1;
      const day = targetDate.getUTCDate();

      const baseRows = await step.run(`resolve-candidates-${setting.id}-${dateKey}`, async () => {
        if (setting.triggerType === "BIRTHDAY") {
          return prisma.$queryRaw<Array<{ userId: string; checkInCount: number }>>`
            SELECT
              u."userId" AS "userId",
              COUNT(DISTINCT c."id")::int AS "checkInCount"
            FROM "users" u
            LEFT JOIN "user_surveys" s ON s."id" = u."surveyId"
            LEFT JOIN "user_checkins" c
              ON c."userId" = u."userId"
              AND c."officialAccountId" = ${setting.officialAccountId}
            WHERE s."birthDate" IS NOT NULL
              AND EXTRACT(MONTH FROM timezone('Asia/Tokyo', s."birthDate"))::int = ${month}
              AND EXTRACT(DAY FROM timezone('Asia/Tokyo', s."birthDate"))::int = ${day}
              AND u."officialAccountId" = ${setting.officialAccountId}
              ${setting.targetRankIds.length > 0 ? Prisma.sql`AND u."nextRank" IN (${Prisma.join(setting.targetRankIds)})` : Prisma.empty}
              ${setting.targetGender ? Prisma.sql`AND s."gender" = ${setting.targetGender}` : Prisma.empty}
            GROUP BY u."userId"
          `;
        }

        const start = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), -9, 0, 0, 0));
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        return prisma.$queryRaw<Array<{ userId: string; checkInCount: number }>>`
          SELECT
            u."userId" AS "userId",
            COUNT(DISTINCT c."id")::int AS "checkInCount"
          FROM "user_gifts" ug
          INNER JOIN "users" u ON u."userId" = ug."userId"
          INNER JOIN "gifts" g
            ON g."id" = ug."giftId"
            AND g."officialAccountId" = ${setting.officialAccountId}
          LEFT JOIN "user_surveys" s ON s."id" = u."surveyId"
          LEFT JOIN "user_checkins" c
            ON c."userId" = u."userId"
            AND c."officialAccountId" = ${setting.officialAccountId}
          WHERE ug."isUsed" = false
            AND ug."expiresAt" >= ${start}
            AND ug."expiresAt" < ${end}
            AND u."officialAccountId" = ${setting.officialAccountId}
            ${setting.targetRankIds.length > 0 ? Prisma.sql`AND u."nextRank" IN (${Prisma.join(setting.targetRankIds)})` : Prisma.empty}
            ${setting.targetGender ? Prisma.sql`AND s."gender" = ${setting.targetGender}` : Prisma.empty}
          GROUP BY u."userId"
        `;
      });

      const filteredUserIds = baseRows
        .filter((row) => {
          if (setting.targetVisitCountSegments.length === 0) return true;
          return setting.targetVisitCountSegments.includes(resolveVisitCountSegment(row.checkInCount));
        })
        .map((row) => row.userId);
      if (filteredUserIds.length === 0) {
        continue;
      }

      await step.run(`enqueue-scheduled-delivery-${setting.id}-${dateKey}`, async () => {
        await inngest.send({
          name: "line/delivery.triggered",
          data: {
            title: setting.title,
            notificationText: setting.notificationText || setting.message,
            messages: Array.isArray(setting.messages)
              ? setting.messages
              : [
                  {
                    type: "text",
                    text: setting.message,
                  },
                ],
            officialAccountId: setting.officialAccountId,
            targetUserIds: filteredUserIds,
            triggeredBy: triggerKey,
          },
        });
      });
    }

    return { ok: true };
  },
);
