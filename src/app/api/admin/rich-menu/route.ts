import { z } from "zod";

import { getCurrentAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { getRichMenuTemplate } from "@/lib/rich-menu";

const richMenuUriSchema = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .refine((value) => {
    try {
      return ["https:", "http:", "tel:", "mailto:"].includes(
        new URL(value).protocol,
      );
    } catch {
      return false;
    }
  }, "有効なURLを入力してください。");

const richMenuActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({
    type: z.literal("uri"),
    uri: richMenuUriSchema,
  }),
  z.object({
    type: z.literal("message"),
    text: z.string().trim().min(1).max(300),
  }),
  z.object({
    type: z.literal("postback"),
    data: z.string().trim().min(1).max(300),
    displayText: z.string().trim().max(300),
  }),
]);

const saveRichMenuSchema = z.object({
  name: z.string().trim().min(1).max(300),
  templateKey: z.string().trim().min(1).max(40),
  selected: z.boolean(),
  chatBarText: z.string().trim().min(1).max(14),
  imageUrl: z.string().url().nullable(),
  areas: z.array(richMenuActionSchema).max(20),
});

export async function PUT(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin?.officialAccountId) {
    return Response.json({ message: "認証が必要です。" }, { status: 401 });
  }

  const parsed = saveRichMenuSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" },
      { status: 400 },
    );
  }

  const template = getRichMenuTemplate(parsed.data.templateKey);
  if (!template || parsed.data.areas.length !== template.areas.length) {
    return Response.json(
      { message: "リッチメニューのテンプレート構成が不正です。" },
      { status: 400 },
    );
  }

  const richMenu = await prisma.storeRichMenu.upsert({
    where: { officialAccountId: admin.officialAccountId },
    create: {
      officialAccountId: admin.officialAccountId,
      name: parsed.data.name,
      imageUrl: parsed.data.imageUrl,
      templateKey: template.key,
      sizeWidth: template.width,
      sizeHeight: template.height,
      selected: parsed.data.selected,
      chatBarText: parsed.data.chatBarText,
      areas: parsed.data.areas,
      status: "DRAFT",
      lastError: null,
    },
    update: {
      name: parsed.data.name,
      imageUrl: parsed.data.imageUrl,
      templateKey: template.key,
      sizeWidth: template.width,
      sizeHeight: template.height,
      selected: parsed.data.selected,
      chatBarText: parsed.data.chatBarText,
      areas: parsed.data.areas,
      status: "DRAFT",
      lastError: null,
    },
  });

  return Response.json({
    ok: true,
    richMenu: {
      id: richMenu.id,
      status: richMenu.status,
      lineRichMenuId: richMenu.lineRichMenuId,
      updatedAt: richMenu.updatedAt.toISOString(),
    },
  });
}
