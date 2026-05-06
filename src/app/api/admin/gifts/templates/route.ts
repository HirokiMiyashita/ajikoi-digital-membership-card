import { adminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function toDisplayUrl(imageUrl: string) {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }
  return `/api/admin/blob?pathname=${encodeURIComponent(imageUrl)}`;
}

export async function GET(request: Request) {
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

  const templates = await prisma.giftImageTemplate.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      sortOrder: true,
    },
  });

  return Response.json({
    ok: true,
    templates: templates.map((template) => ({
      ...template,
      imagePath: template.imageUrl,
      displayUrl: toDisplayUrl(template.imageUrl),
    })),
  });
}
