import { adminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

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
    select: { id: true, officialAccountId: true },
  });
  if (!adminUser?.officialAccountId) {
    return Response.json(
      { ok: false, message: "管理者権限がありません。" },
      { status: 403 },
    );
  }

  const gifts = await prisma.gift.findMany({
    where: { officialAccountId: adminUser.officialAccountId! },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      expiryType: true,
      expiryDays: true,
      expiryAt: true,
    },
    take: 200,
  });

  const users = await prisma.user.findMany({
    where: { officialAccountId: adminUser.officialAccountId },
    orderBy: { createdAt: "desc" },
    select: {
      userId: true,
      displayName: true,
    },
    take: 500,
  });

  return Response.json({
    ok: true,
    gifts,
    users,
  });
}
