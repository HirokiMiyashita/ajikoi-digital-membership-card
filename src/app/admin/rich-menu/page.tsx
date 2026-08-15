import { requireAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import {
  createEmptyRichMenuActions,
  getRichMenuTemplate,
  parseRichMenuActions,
} from "@/lib/rich-menu";

import RichMenuEditorClient from "./rich-menu-editor-client";

export default async function RichMenuPage() {
  const admin = await requireAdminUser();
  const officialAccountId = admin.officialAccountId!;

  const [officialAccount, storedRichMenu] = await Promise.all([
    prisma.officialAccount.findUniqueOrThrow({
      where: { id: officialAccountId },
      select: {
        name: true,
        displayName: true,
        liffId: true,
      },
    }),
    prisma.storeRichMenu.findUnique({
      where: { officialAccountId },
      select: {
        name: true,
        lineRichMenuId: true,
        imageUrl: true,
        templateKey: true,
        selected: true,
        chatBarText: true,
        areas: true,
        status: true,
        lastError: true,
      },
    }),
  ]);

  const template =
    getRichMenuTemplate(storedRichMenu?.templateKey ?? "large-6") ??
    getRichMenuTemplate("large-6")!;
  const actions = storedRichMenu
    ? parseRichMenuActions(storedRichMenu.areas, template.areas.length)
    : createEmptyRichMenuActions(template.areas.length);
  const liffUrl = officialAccount.liffId
    ? `https://liff.line.me/${officialAccount.liffId}`
    : "";

  return (
    <RichMenuEditorClient
      storeName={officialAccount.displayName ?? officialAccount.name ?? "店舗"}
      liffUrl={liffUrl}
      initialValue={{
        name: storedRichMenu?.name ?? "店舗リッチメニュー",
        imageUrl: storedRichMenu?.imageUrl ?? null,
        templateKey: template.key,
        selected: storedRichMenu?.selected ?? true,
        chatBarText: storedRichMenu?.chatBarText ?? "メニュー",
        areas: actions,
        status: storedRichMenu?.status ?? "DRAFT",
        isPublished: Boolean(storedRichMenu?.lineRichMenuId),
        lastError: storedRichMenu?.lastError ?? null,
      }}
    />
  );
}
