import {
  cancelDefaultLineRichMenu,
  createLineRichMenu,
  deleteLineRichMenu,
  getLineBotInfo,
  setDefaultLineRichMenu,
  uploadLineRichMenuImage,
} from "@/lib/line-rich-menu";
import { getCurrentAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import {
  getRichMenuTemplate,
  parseRichMenuActions,
} from "@/lib/rich-menu";
import { getConfiguredStoreLineAccessToken } from "@/lib/store";

const MAX_IMAGE_SIZE_BYTES = 1024 * 1024;

function isAllowedImageUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}

async function loadRichMenuImage(imageUrl: string) {
  if (!isAllowedImageUrl(imageUrl)) {
    throw new Error("登録済みのリッチメニュー画像URLが不正です。");
  }
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error("登録済みのリッチメニュー画像を取得できませんでした。");
  }
  const contentType = response.headers.get("content-type")?.split(";")[0];
  if (contentType !== "image/png" && contentType !== "image/jpeg") {
    throw new Error("リッチメニュー画像はPNGまたはJPEGにしてください。");
  }
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("リッチメニュー画像は1MB以下にしてください。");
  }
  const image = await response.arrayBuffer();
  if (image.byteLength > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("リッチメニュー画像は1MB以下にしてください。");
  }
  return {
    image,
    contentType: contentType as "image/jpeg" | "image/png",
  };
}

async function assertTokenMatchesStore(
  officialAccountId: string,
  accessToken: string,
) {
  const store = await prisma.officialAccount.findUniqueOrThrow({
    where: { id: officialAccountId },
    select: { lineBasicId: true },
  });
  const botInfo = await getLineBotInfo(accessToken);
  const configuredBasicId = store.lineBasicId.replace(/^@/, "").toLowerCase();
  const tokenBasicId = botInfo.basicId.replace(/^@/, "").toLowerCase();
  if (configuredBasicId !== tokenBasicId) {
    throw new Error(
      `店舗に登録されたLINE公式アカウント（${store.lineBasicId}）とChannel Access Tokenのアカウント（${botInfo.basicId}）が一致しません。`,
    );
  }
}

export async function POST() {
  const admin = await getCurrentAdminUser();
  if (!admin?.officialAccountId) {
    return Response.json({ message: "認証が必要です。" }, { status: 401 });
  }

  const richMenu = await prisma.storeRichMenu.findUnique({
    where: { officialAccountId: admin.officialAccountId },
  });
  if (!richMenu) {
    return Response.json(
      { message: "先にリッチメニューを保存してください。" },
      { status: 404 },
    );
  }
  if (!richMenu.imageUrl) {
    return Response.json(
      { message: "リッチメニュー画像を登録してください。" },
      { status: 400 },
    );
  }

  const accessToken = await getConfiguredStoreLineAccessToken(
    admin.officialAccountId,
  );
  if (!accessToken) {
    return Response.json(
      { message: "店舗設定でLINE Channel Access Tokenを登録してください。" },
      { status: 400 },
    );
  }

  const template = getRichMenuTemplate(richMenu.templateKey);
  if (!template) {
    return Response.json(
      { message: "保存されているテンプレートが不正です。" },
      { status: 400 },
    );
  }
  const actions = parseRichMenuActions(richMenu.areas, template.areas.length);
  const areas = template.areas.flatMap((bounds, index) => {
    const action = actions[index];
    return action && action.type !== "none" ? [{ bounds, action }] : [];
  });
  if (areas.length === 0) {
    return Response.json(
      { message: "少なくとも1つのエリアにアクションを設定してください。" },
      { status: 400 },
    );
  }

  let newRichMenuId: string | null = null;
  try {
    await assertTokenMatchesStore(admin.officialAccountId, accessToken);
    const { image, contentType } = await loadRichMenuImage(richMenu.imageUrl);
    newRichMenuId = await createLineRichMenu({
      accessToken,
      name: richMenu.name,
      width: template.width,
      height: template.height,
      selected: richMenu.selected,
      chatBarText: richMenu.chatBarText,
      areas,
    });
    await uploadLineRichMenuImage({
      accessToken,
      richMenuId: newRichMenuId,
      image,
      contentType,
    });
    await setDefaultLineRichMenu(accessToken, newRichMenuId);

    const oldRichMenuId = richMenu.lineRichMenuId;
    await prisma.storeRichMenu.update({
      where: { officialAccountId: admin.officialAccountId },
      data: {
        lineRichMenuId: newRichMenuId,
        status: "PUBLISHED",
        lastPublishedAt: new Date(),
        lastError: null,
      },
    });

    if (oldRichMenuId && oldRichMenuId !== newRichMenuId) {
      await deleteLineRichMenu(accessToken, oldRichMenuId).catch(() => undefined);
    }

    return Response.json({ ok: true, lineRichMenuId: newRichMenuId });
  } catch (error) {
    if (newRichMenuId) {
      await deleteLineRichMenu(accessToken, newRichMenuId).catch(() => undefined);
    }
    const message =
      error instanceof Error ? error.message : "LINEへの公開に失敗しました。";
    await prisma.storeRichMenu.update({
      where: { officialAccountId: admin.officialAccountId },
      data: { status: "ERROR", lastError: message },
    });
    return Response.json({ message }, { status: 502 });
  }
}

export async function DELETE() {
  const admin = await getCurrentAdminUser();
  if (!admin?.officialAccountId) {
    return Response.json({ message: "認証が必要です。" }, { status: 401 });
  }
  const richMenu = await prisma.storeRichMenu.findUnique({
    where: { officialAccountId: admin.officialAccountId },
  });
  if (!richMenu?.lineRichMenuId) {
    return Response.json(
      { message: "公開中のリッチメニューはありません。" },
      { status: 404 },
    );
  }
  const accessToken = await getConfiguredStoreLineAccessToken(
    admin.officialAccountId,
  );
  if (!accessToken) {
    return Response.json(
      { message: "店舗設定でLINE Channel Access Tokenを登録してください。" },
      { status: 400 },
    );
  }

  try {
    await assertTokenMatchesStore(admin.officialAccountId, accessToken);
    await cancelDefaultLineRichMenu(accessToken);
    await deleteLineRichMenu(accessToken, richMenu.lineRichMenuId);
    await prisma.storeRichMenu.update({
      where: { officialAccountId: admin.officialAccountId },
      data: {
        lineRichMenuId: null,
        status: "DRAFT",
        lastError: null,
      },
    });
    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "公開解除に失敗しました。";
    await prisma.storeRichMenu.update({
      where: { officialAccountId: admin.officialAccountId },
      data: { status: "ERROR", lastError: message },
    });
    return Response.json({ message }, { status: 502 });
  }
}
