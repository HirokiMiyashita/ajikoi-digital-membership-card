import { requireAdminUser } from "@/lib/admin-guard";

import GiftsClient from "../gifts-client";

export default async function AdminGiftCreatePage() {
  await requireAdminUser();

  return <GiftsClient mode="create" />;
}
