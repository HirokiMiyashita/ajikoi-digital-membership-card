import { requireAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import StoreSettingsForm from "./store-settings-form";

export default async function StoreSettingsPage() {
  const admin = await requireAdminUser();
  const store = await prisma.officialAccount.findUniqueOrThrow({
    where: { id: admin.officialAccountId! },
  });
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    (vercelHost ? `https://${vercelHost}` : "http://localhost:3000");
  const memberUrl = `${baseUrl}/s/${store.slug}`;
  const richMenuUrl = store.liffId
    ? `https://liff.line.me/${store.liffId}`
    : "";

  return (
    <div className="space-y-4 p-4">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-bold">店舗設定</h1>
        <p className="text-sm text-[#64748b]">会員証のブランド表示とLINE連携を管理します。</p>
      </div>
      <StoreSettingsForm
        initialValues={{
          name: store.name ?? "",
          displayName: store.displayName ?? "",
          logoUrl: store.logoUrl ?? "",
          themeColor: store.themeColor,
          liffId: store.liffId ?? "",
          lineAddFriendUrl: store.lineAddFriendUrl ?? "",
          googleReviewUrl: store.googleReviewUrl ?? "",
        }}
        liffEndpointUrl={memberUrl}
        richMenuUrl={richMenuUrl}
      />
    </div>
  );
}
