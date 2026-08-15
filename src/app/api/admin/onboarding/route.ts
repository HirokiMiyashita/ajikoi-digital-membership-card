import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/store-crypto";
import { assertValidStoreSlug } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const authUserId = data?.claims?.sub;
  if (error || !authUserId) {
    return Response.json({ message: "認証が必要です。" }, { status: 401 });
  }

  const body = (await request.json()) as {
    storeName?: string;
    slug?: string;
    lineBasicId?: string;
    liffId?: string;
    lineAddFriendUrl?: string;
    lineChannelAccessToken?: string;
    googleReviewUrl?: string;
  };

  const storeName = body.storeName?.trim();
  const lineBasicId = body.lineBasicId?.trim();
  if (!storeName || !lineBasicId || !body.slug) {
    return Response.json(
      { message: "店舗名・店舗URL・LINE公式アカウントIDは必須です。" },
      { status: 400 },
    );
  }

  try {
    const slug = assertValidStoreSlug(body.slug);
    const metadata = data.claims.user_metadata as
      | { display_name?: string; full_name?: string; avatar_url?: string }
      | undefined;

    const store = await prisma.$transaction(async (tx) => {
      const existingAdmin = await tx.adminUser.findUnique({ where: { id: authUserId } });
      if (existingAdmin?.officialAccountId) {
        throw new Error("ALREADY_ONBOARDED");
      }

      const createdStore = await tx.officialAccount.create({
        data: {
          slug,
          name: storeName,
          displayName: storeName,
          lineBasicId,
          liffId: body.liffId?.trim() || null,
          lineAddFriendUrl: body.lineAddFriendUrl?.trim() || null,
          lineChannelAccessToken: body.lineChannelAccessToken?.trim()
            ? encryptSecret(body.lineChannelAccessToken.trim())
            : null,
          googleReviewUrl: body.googleReviewUrl?.trim() || null,
          visitQrToken: randomBytes(24).toString("base64url"),
          onboardingCompletedAt: new Date(),
          storeStatus: { create: { isOpen: false } },
        },
      });

      await tx.adminUser.upsert({
        where: { id: authUserId },
        create: {
          id: authUserId,
          email: typeof data.claims.email === "string" ? data.claims.email : null,
          displayName: metadata?.display_name ?? metadata?.full_name ?? null,
          avatarUrl: metadata?.avatar_url ?? null,
          officialAccountId: createdStore.id,
        },
        update: {
          email: typeof data.claims.email === "string" ? data.claims.email : null,
          displayName: metadata?.display_name ?? metadata?.full_name ?? null,
          avatarUrl: metadata?.avatar_url ?? null,
          officialAccountId: createdStore.id,
        },
      });

      return createdStore;
    });

    return Response.json({ ok: true, slug: store.slug });
  } catch (caught) {
    if (caught instanceof Error && caught.message === "ALREADY_ONBOARDED") {
      return Response.json({ message: "店舗設定はすでに完了しています。" }, { status: 409 });
    }
    if (caught instanceof Error && caught.message.includes("店舗URL")) {
      return Response.json({ message: caught.message }, { status: 400 });
    }
    if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === "P2002") {
      return Response.json(
        { message: "店舗URLまたはLINE公式アカウントIDはすでに使用されています。" },
        { status: 409 },
      );
    }
    console.error(caught);
    return Response.json({ message: "店舗の作成に失敗しました。" }, { status: 500 });
  }
}
