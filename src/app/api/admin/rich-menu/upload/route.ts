import { put } from "@vercel/blob";

import { getCurrentAdminUser } from "@/lib/admin-guard";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_FILE_SIZE_BYTES = 1024 * 1024;

export async function POST(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin?.officialAccountId) {
    return Response.json({ message: "認証が必要です。" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json(
      { message: "画像ファイルを指定してください。" },
      { status: 400 },
    );
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return Response.json(
      { message: "PNGまたはJPEG画像を選択してください。" },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return Response.json(
      { message: "LINEの仕様に合わせ、画像は1MB以下にしてください。" },
      { status: 400 },
    );
  }

  try {
    const extension = file.type === "image/png" ? "png" : "jpg";
    const blob = await put(
      `stores/${admin.officialAccountId}/rich-menu/${Date.now()}.${extension}`,
      file,
      {
        access: "public",
        addRandomSuffix: true,
        contentType: file.type,
      },
    );
    return Response.json({ ok: true, imageUrl: blob.url });
  } catch {
    return Response.json(
      { message: "画像アップロードに失敗しました。BLOB設定を確認してください。" },
      { status: 500 },
    );
  }
}
