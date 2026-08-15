import { prisma } from "@/lib/prisma";

export type StoreRank = {
  id: string;
  name: string;
  minPoints: number;
  maxPoints: number;
  sortOrder: number;
};

const DEFAULT_RANKS = [
  { name: "レギュラー", minPoints: 0 },
  { name: "シルバー", minPoints: 3 },
  { name: "ゴールド", minPoints: 10 },
  { name: "プラチナ", minPoints: 30 },
  { name: "ダイヤモンド", minPoints: 50 },
] as const;

export async function ensureStoreRanks(officialAccountId: string) {
  const count = await prisma.rank.count({
    where: { officialAccountId },
  });
  if (count === 0) {
    await prisma.rank.createMany({
      data: DEFAULT_RANKS.map((rank, index) => ({
        officialAccountId,
        name: rank.name,
        minPoints: rank.minPoints,
        maxPoints:
          index < DEFAULT_RANKS.length - 1
            ? DEFAULT_RANKS[index + 1].minPoints - 1
            : 2_147_483_647,
        sortOrder: index,
        isActive: true,
      })),
    });
  }
}

export async function getStoreRanks(officialAccountId: string): Promise<StoreRank[]> {
  await ensureStoreRanks(officialAccountId);
  return prisma.rank.findMany({
    where: {
      officialAccountId,
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { minPoints: "asc" }],
    select: {
      id: true,
      name: true,
      minPoints: true,
      maxPoints: true,
      sortOrder: true,
    },
  });
}

export function findStoreRankByPoints(ranks: StoreRank[], points: number) {
  const rank = ranks.find(
    (candidate) => points >= candidate.minPoints && points <= candidate.maxPoints,
  );
  if (!rank) {
    throw new Error(`ポイント ${points} に対応するランクがありません。`);
  }
  return rank;
}

export function findNextStoreRankByPoints(ranks: StoreRank[], points: number) {
  return ranks.find((candidate) => candidate.minPoints > points) ?? null;
}
