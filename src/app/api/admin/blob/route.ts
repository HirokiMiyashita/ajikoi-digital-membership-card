import { get } from "@vercel/blob";
import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await adminAuth.api.getSession({
    headers: request.headers,
  });
  const adminId = session?.user?.username;
  if (!adminId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { id: true },
  });
  if (!adminUser) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const pathname = searchParams.get("pathname");
  if (!pathname) {
    return NextResponse.json({ ok: false, message: "pathname is required" }, { status: 400 });
  }

  const result = await get(pathname, {
    access: "private",
    ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
  });
  if (!result) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (result.statusCode === 304) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: result.blob.etag,
        "Cache-Control": "private, no-cache",
      },
    });
  }

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      "X-Content-Type-Options": "nosniff",
      ETag: result.blob.etag,
      "Cache-Control": "private, no-cache",
    },
  });
}
