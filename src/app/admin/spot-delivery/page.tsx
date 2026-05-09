import { requireAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

import SpotDeliveryClient from "./spot-delivery-client";

type DeliveryHistoryRow = {
  id: string;
  title: string;
  sentAt: string;
  sent: number;
  failed: number;
};

export default async function AdminSpotDeliveryPage() {
  const adminUser = await requireAdminUser();
  const [histories, triggerSettings] = await Promise.all([
    prisma.userHistory.findMany({
      where: {
        action: "line_trigger_delivery_executed",
        ...(adminUser.officialAccountId ? { officialAccountId: adminUser.officialAccountId } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        metadata: true,
      },
      take: 50,
    }),
    prisma.lineDeliveryTriggerSetting.findMany({
      where: adminUser.officialAccountId ? { officialAccountId: adminUser.officialAccountId } : undefined,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        triggerType: true,
        notificationText: true,
        messages: true,
        message: true,
        targetRankIds: true,
        targetGender: true,
        targetVisitCountSegments: true,
        isActive: true,
        updatedAt: true,
      },
      take: 100,
    }),
  ]);

  const deliveryHistory: DeliveryHistoryRow[] = histories.map((row) => {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const metadataTitle = typeof metadata.title === "string" ? metadata.title : "";
    const metadataMessage = typeof metadata.message === "string" ? metadata.message : "";
    const title = metadataTitle.trim() || metadataMessage.trim() || "タイトル未設定";
    const sent = typeof metadata.sent === "number" ? metadata.sent : 0;
    const failed = typeof metadata.failed === "number" ? metadata.failed : 0;
    return {
      id: row.id,
      title,
      sentAt: row.createdAt.toISOString(),
      sent,
      failed,
    };
  });

  return (
    <SpotDeliveryClient
      deliveryHistory={deliveryHistory}
      triggerSettings={triggerSettings.map((row) => ({
        id: row.id,
        title: row.title,
        triggerType: row.triggerType,
        notificationText: row.notificationText,
        messages: row.messages,
        message: row.message,
        targetRankIds: row.targetRankIds,
        targetGender: row.targetGender,
        targetVisitCountSegments: row.targetVisitCountSegments,
        isActive: row.isActive,
        updatedAt: row.updatedAt.toISOString(),
      }))}
    />
  );
}
