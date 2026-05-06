import { put } from "@vercel/blob";

import { adminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await adminAuth.api.getSession({
    headers: request.headers,
  });
  const adminId = session?.user?.username;
  if (!adminId) {
    return Response.json(
      { ok: false, message: "管理者ログインが必要です。" },
      { status: 401 },
    );
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { id: true },
  });
  if (!adminUser) {
    return Response.json(
      { ok: false, message: "管理者権限がありません。" },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json(
      { ok: false, message: "画像ファイルを指定してください。" },
      { status: 400 },
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return Response.json(
      { ok: false, message: "対応していないファイル形式です。" },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return Response.json(
      { ok: false, message: "ファイルサイズは15MB以下にしてください。" },
      { status: 400 },
    );
  }

  try {
    const blob = await put(`gifts/${Date.now()}-${file.name}`, file, {
      access: "private",
      addRandomSuffix: true,
    });
    return Response.json({
      ok: true,
      imagePath: blob.pathname,
      previewUrl: `/api/admin/blob?pathname=${encodeURIComponent(blob.pathname)}`,
    });
  } catch {
    return Response.json(
      { ok: false, message: "画像アップロードに失敗しました。BLOB設定を確認してください。" },
      { status: 500 },
    );
  }
}
