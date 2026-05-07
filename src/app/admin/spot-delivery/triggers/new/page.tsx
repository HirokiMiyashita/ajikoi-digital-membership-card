import { requireAdminUser } from "@/lib/admin-guard";
import TriggerDeliveryEditorClient from "./trigger-delivery-editor-client";

export default async function AdminTriggerDeliveryNewPage() {
  await requireAdminUser();
  return <TriggerDeliveryEditorClient />;
}
