import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();

const templates = [
  { name: "テンプレート 1", sourceFile: "benefits-1.png" },
  { name: "テンプレート 2", sourceFile: "benefits-3.png" },
  { name: "テンプレート 3", sourceFile: "benefits-4.png" },
  { name: "テンプレート 4", sourceFile: "benefits-5.png" },
  { name: "テンプレート 5", sourceFile: "benefits-11.png" },
  { name: "テンプレート 6", sourceFile: "coupon6611721633460277.png" },
];

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN が未設定です。");
  }

  for (let index = 0; index < templates.length; index += 1) {
    const item = templates[index];
    const sortOrder = index + 1;
    const localPath = path.join(process.cwd(), "public", item.sourceFile);
    const png = await readFile(localPath);

    const blob = await put(`gift-templates/template-${sortOrder}.png`, png, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "image/png",
    });

    await prisma.giftImageTemplate.upsert({
      where: { sortOrder },
      update: {
        name: item.name,
        imageUrl: blob.url,
        isActive: true,
      },
      create: {
        name: item.name,
        imageUrl: blob.url,
        sortOrder,
        isActive: true,
      },
    });

    const legacyRelativeSvgPath = `gift-templates/template-${sortOrder}.svg`;
    await prisma.gift.updateMany({
      where: {
        imageUrl: legacyRelativeSvgPath,
      },
      data: {
        imageUrl: blob.url,
      },
    });
    await prisma.$executeRaw`
      UPDATE "gifts"
      SET "imageUrl" = ${blob.url}, "updatedAt" = NOW()
      WHERE "imageUrl" LIKE ${`%/gift-templates/template-${sortOrder}.svg`}
    `;
  }

  console.log(JSON.stringify({ ok: true, templates: templates.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
