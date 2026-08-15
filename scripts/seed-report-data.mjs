import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OFFICIAL_LINE_BASIC_ID = process.env.LINE_OFFICIAL_ACCOUNT_ID?.trim() || "@607wzgdz";
const DEMO_USER_PREFIX = "demo-user-";
const DEMO_USER_COUNT = 48;
const DAY_SPAN = 14;
const genderOptions = ["male", "female", "other"];
const visitFrequencyOptions = ["1", "2", "3", "4", "5_plus"];
const companionOptions = ["alone", "family", "partner_or_friends", "coworkers", "other"];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDateInDay(dayStart) {
  const date = new Date(dayStart);
  date.setHours(randomInt(9, 21), randomInt(0, 59), randomInt(0, 59), 0);
  return date;
}

function addDays(base, days) {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return date;
}

function getStartOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function randomBirthDate() {
  const year = randomInt(1960, 2005);
  const month = randomInt(0, 11);
  const day = randomInt(1, 28);
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

async function resolveOfficialAccountId() {
  await prisma.$executeRaw`
    INSERT INTO "official_accounts" ("id", "lineBasicId", "name", "updatedAt")
    VALUES (md5(random()::text || clock_timestamp()::text), ${OFFICIAL_LINE_BASIC_ID}, ${OFFICIAL_LINE_BASIC_ID}, NOW())
    ON CONFLICT ("lineBasicId")
    DO UPDATE SET "updatedAt" = NOW()
  `;

  const rows = await prisma.$queryRaw`
    SELECT "id"
    FROM "official_accounts"
    WHERE "lineBasicId" = ${OFFICIAL_LINE_BASIC_ID}
    LIMIT 1
  `;

  return rows[0]?.id ?? null;
}

async function getDefaultRankId() {
  const regular = await prisma.rank.findUnique({ where: { id: "regular" } });
  if (regular) return regular.id;

  const first = await prisma.rank.findFirst({
    orderBy: { minPoints: "asc" },
    select: { id: true },
  });
  if (!first) {
    throw new Error("ranks テーブルが空です。先に migration を適用してください。");
  }

  return first.id;
}

async function main() {
  const officialAccountId = await resolveOfficialAccountId();
  if (!officialAccountId) {
    throw new Error("official_accounts の作成/取得に失敗しました。");
  }

  const defaultRankId = await getDefaultRankId();

  const deleted = await prisma.user.deleteMany({
    where: {
      userId: {
        startsWith: DEMO_USER_PREFIX,
      },
    },
  });
  await prisma.userSurvey.deleteMany({
    where: {
      users: {
        none: {},
      },
    },
  });

  const today = getStartOfDay(new Date());
  const firstDay = addDays(today, -(DAY_SPAN - 1));

  let totalCheckins = 0;
  let repeaterUsers = 0;

  for (let i = 0; i < DEMO_USER_COUNT; i += 1) {
    const userId = `${DEMO_USER_PREFIX}${String(i + 1).padStart(3, "0")}`;
    const createdOffset = randomInt(0, DAY_SPAN - 1);
    const createdAt = randomDateInDay(addDays(firstDay, createdOffset));
    const visitCount = randomInt(0, 6);
    const isRepeater = visitCount >= 2;
    if (isRepeater) repeaterUsers += 1;
    const visitFrequency = visitFrequencyOptions[Math.min(visitCount, 4)];
    const survey = await prisma.userSurvey.create({
      data: {
        gender: genderOptions[randomInt(0, genderOptions.length - 1)],
        visitFrequency,
        companionType: companionOptions[randomInt(0, companionOptions.length - 1)],
        birthDate: randomBirthDate(),
      },
    });

    await prisma.user.create({
      data: {
        userId,
        displayName: `テスト会員${String(i + 1).padStart(3, "0")}`,
        isTest: true,
        points: visitCount,
        nextRank: defaultRankId,
        officialAccountId,
        officialLinkedAt: createdAt,
        surveyId: survey.id,
        createdAt,
        updatedAt: createdAt,
        lastCheckInAt: visitCount > 0 ? randomDateInDay(today) : null,
      },
    });

    if (visitCount === 0) continue;

    const checkinRows = [];
    for (let visitIndex = 0; visitIndex < visitCount; visitIndex += 1) {
      const dayOffset = randomInt(createdOffset, DAY_SPAN - 1);
      const checkedInAt = randomDateInDay(addDays(firstDay, dayOffset));
      checkinRows.push({
        id: `${userId}-checkin-${visitIndex + 1}`,
        userId,
        checkedInAt,
        isFirstVisit: visitIndex === 0,
        isRepeatVisit: visitIndex > 0,
        officialAccountId,
        createdAt: checkedInAt,
      });
    }

    checkinRows.sort((a, b) => a.checkedInAt.getTime() - b.checkedInAt.getTime());
    await prisma.userCheckIn.createMany({
      data: checkinRows,
    });
    totalCheckins += checkinRows.length;

    const lastCheckInAt = checkinRows[checkinRows.length - 1].checkedInAt;
    await prisma.user.update({
      where: { userId },
      data: { lastCheckInAt, updatedAt: lastCheckInAt },
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        officialLineBasicId: OFFICIAL_LINE_BASIC_ID,
        officialAccountId,
        deletedDemoUsers: deleted.count,
        createdDemoUsers: DEMO_USER_COUNT,
        repeaterUsers,
        totalCheckins,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
