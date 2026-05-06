import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const templates = [
  { name: "テンプレート 1", color: "#0f9f99", text: "DRINK TICKET" },
  { name: "テンプレート 2", color: "#1d4ed8", text: "WELCOME GIFT" },
  { name: "テンプレート 3", color: "#dc2626", text: "SPECIAL COUPON" },
  { name: "テンプレート 4", color: "#9333ea", text: "HAPPY GIFT" },
  { name: "テンプレート 5", color: "#ea580c", text: "LIMITED OFFER" },
  { name: "テンプレート 6", color: "#059669", text: "THANK YOU TICKET" },
];

function createSvg({ color, text }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" rx="40" fill="${color}" />
  <rect x="40" y="40" width="1120" height="550" rx="30" fill="white" fill-opacity="0.14" />
  <text x="80" y="320" font-family="Arial, sans-serif" font-size="88" font-weight="700" fill="white">${text}</text>
  <text x="80" y="390" font-family="Arial, sans-serif" font-size="34" fill="white">AJIKOI DIGITAL MEMBERSHIP CARD</text>
</svg>`;
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN が未設定です。");
  }

  for (let index = 0; index < templates.length; index += 1) {
    const item = templates[index];
    const sortOrder = index + 1;
    const svg = createSvg(item);

    const blob = await put(`gift-templates/template-${sortOrder}.svg`, Buffer.from(svg), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "image/svg+xml",
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
