import type { RichMenuAction, RichMenuBounds } from "@/lib/rich-menu";

const LINE_API_BASE_URL = "https://api.line.me/v2/bot";
const LINE_DATA_API_BASE_URL = "https://api-data.line.me/v2/bot";

type RichMenuArea = {
  bounds: RichMenuBounds;
  action: Exclude<RichMenuAction, { type: "none" }>;
};

async function lineApiRequest(
  url: string,
  accessToken: string,
  init: RequestInit,
) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LINE APIエラー (${response.status}): ${detail}`);
  }
  return response;
}

export async function getLineBotInfo(accessToken: string) {
  const response = await lineApiRequest(
    `${LINE_API_BASE_URL}/info`,
    accessToken,
    { method: "GET" },
  );
  return (await response.json()) as {
    userId: string;
    basicId: string;
    displayName: string;
    pictureUrl?: string;
  };
}

export async function createLineRichMenu(params: {
  accessToken: string;
  name: string;
  width: number;
  height: number;
  selected: boolean;
  chatBarText: string;
  areas: RichMenuArea[];
}) {
  const response = await lineApiRequest(
    `${LINE_API_BASE_URL}/richmenu`,
    params.accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        size: { width: params.width, height: params.height },
        selected: params.selected,
        name: params.name,
        chatBarText: params.chatBarText,
        areas: params.areas,
      }),
    },
  );
  const body = (await response.json()) as { richMenuId?: string };
  if (!body.richMenuId) {
    throw new Error("LINEからリッチメニューIDが返されませんでした。");
  }
  return body.richMenuId;
}

export async function uploadLineRichMenuImage(params: {
  accessToken: string;
  richMenuId: string;
  image: ArrayBuffer;
  contentType: "image/jpeg" | "image/png";
}) {
  await lineApiRequest(
    `${LINE_DATA_API_BASE_URL}/richmenu/${encodeURIComponent(params.richMenuId)}/content`,
    params.accessToken,
    {
      method: "POST",
      headers: { "Content-Type": params.contentType },
      body: params.image,
    },
  );
}

export async function setDefaultLineRichMenu(
  accessToken: string,
  richMenuId: string,
) {
  await lineApiRequest(
    `${LINE_API_BASE_URL}/user/all/richmenu/${encodeURIComponent(richMenuId)}`,
    accessToken,
    { method: "POST" },
  );
}

export async function cancelDefaultLineRichMenu(accessToken: string) {
  await lineApiRequest(
    `${LINE_API_BASE_URL}/user/all/richmenu`,
    accessToken,
    { method: "DELETE" },
  );
}

export async function deleteLineRichMenu(
  accessToken: string,
  richMenuId: string,
) {
  await lineApiRequest(
    `${LINE_API_BASE_URL}/richmenu/${encodeURIComponent(richMenuId)}`,
    accessToken,
    { method: "DELETE" },
  );
}
