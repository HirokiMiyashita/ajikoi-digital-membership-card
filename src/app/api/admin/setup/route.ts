import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";

import { adminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const setupKey = process.env.ADMIN_SETUP_KEY;
  const payload = (await request.json()) as {
    adminId?: string;
    password?: string;
    setupKey?: string;
    officialAccountLineId?: string;
  };

  if (!setupKey || payload.setupKey !== setupKey) {
    return Response.json(
      { ok: false, message: "セットアップキーが不正です。" },
      { status: 403 },
    );
  }

  const adminId = payload.adminId?.trim();
  const password = payload.password ?? "";
  const officialAccountLineId = payload.officialAccountLineId?.trim();
  if (!adminId || !password || !officialAccountLineId) {
    return Response.json(
      { ok: false, message: "管理者ID・パスワード・公式アカウントIDは必須です。" },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.adminUser.findUnique({
      where: {
        id: adminId,
      },
    });
    if (existing) {
      return Response.json(
        { ok: false, message: "その管理者IDはすでに存在します。" },
        { status: 409 },
      );
    }

    const email = `${adminId}@admin.local`;
    await prisma.$executeRaw`
      INSERT INTO "official_accounts" ("id", "lineBasicId", "name", "updatedAt")
      VALUES (md5(random()::text || clock_timestamp()::text), ${officialAccountLineId}, ${officialAccountLineId}, NOW())
      ON CONFLICT ("lineBasicId")
      DO UPDATE SET "updatedAt" = NOW()
    `;
    const officialAccountRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "official_accounts"
      WHERE "lineBasicId" = ${officialAccountLineId}
      LIMIT 1
    `;
    const officialAccountId = officialAccountRows[0]?.id;
    if (!officialAccountId) {
      return Response.json(
        { ok: false, message: "公式アカウントの取得に失敗しました。" },
        { status: 500 },
      );
    }

    await adminAuth.api.signUpEmail({
      body: {
        name: adminId,
        email,
        password,
        username: adminId,
        displayUsername: adminId,
      },
      headers: request.headers,
    });

    await prisma.adminUser.create({
      data: {
        id: adminId,
        passwordHash: await hash(password, 10),
      },
    });
    await prisma.$executeRaw`
      UPDATE "admin_user"
      SET "officialAccountId" = ${officialAccountId},
          "updatedAt" = NOW()
      WHERE "id" = ${adminId}
    `;

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return Response.json(
        { ok: false, message: "DBテーブルが未作成です。`npx prisma migrate dev` を実行してください。" },
        { status: 500 },
      );
    }

    return Response.json(
      { ok: false, message: "管理者の作成に失敗しました。" },
      { status: 500 },
    );
  }
}
