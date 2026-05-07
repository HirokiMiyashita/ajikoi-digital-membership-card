import { notFound } from "next/navigation";

import { requireAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import TriggerDeliveryEditorClient from "../new/trigger-delivery-editor-client";

type Props = {
  params: Promise<{ triggerId: string }>;
};

export default async function AdminTriggerDeliveryEditPage({ params }: Props) {
  const adminUser = await requireAdminUser();
  const { triggerId } = await params;
  const trigger = await prisma.lineDeliveryTriggerSetting.findFirst({
    where: {
      id: triggerId,
      ...(adminUser.officialAccountId ? { officialAccountId: adminUser.officialAccountId } : {}),
    },
    select: {
      id: true,
      title: true,
      triggerType: true,
      message: true,
      isActive: true,
    },
  });
  if (!trigger) {
    notFound();
  }

  return (
    <TriggerDeliveryEditorClient
      mode="edit"
      triggerId={trigger.id}
      initialValue={{
        title: trigger.title,
        triggerType: trigger.triggerType as "USER_SIGNUP" | "CHECKIN_POINT_GRANTED" | "RANK_UP",
        message: trigger.message,
        isActive: trigger.isActive,
      }}
    />
  );
}
