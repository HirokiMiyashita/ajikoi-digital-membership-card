import { getCurrentAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/store-crypto";

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function PATCH(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin?.officialAccountId) {
    return Response.json({ message: "認証が必要です。" }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const name = optionalText(body.name);
  const displayName = optionalText(body.displayName);
  const themeColor = optionalText(body.themeColor);
  const latitudeText = optionalText(body.latitude);
  const longitudeText = optionalText(body.longitude);
  const latitude = Number(latitudeText);
  const longitude = Number(longitudeText);
  if (!name || !displayName || !themeColor || !/^#[0-9a-f]{6}$/i.test(themeColor)) {
    return Response.json({ message: "店舗名・表示名・テーマカラーを確認してください。" }, { status: 400 });
  }
  if (
    !latitudeText ||
    !longitudeText ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return Response.json(
      { message: "チェックインに使用する店舗位置を設定してください。" },
      { status: 400 },
    );
  }

  await prisma.officialAccount.update({
    where: { id: admin.officialAccountId },
    data: {
      name,
      displayName,
      themeColor,
      logoUrl: optionalText(body.logoUrl),
      liffId: optionalText(body.liffId),
      lineAddFriendUrl: optionalText(body.lineAddFriendUrl),
      googleReviewUrl: optionalText(body.googleReviewUrl),
      latitude,
      longitude,
      ...(optionalText(body.lineChannelAccessToken)
        ? { lineChannelAccessToken: encryptSecret(optionalText(body.lineChannelAccessToken)!) }
        : {}),
    },
  });

  return Response.json({ ok: true });
}
