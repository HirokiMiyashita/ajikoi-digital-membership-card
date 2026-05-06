CREATE TABLE "user_surveys" (
    "id" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "visitFrequency" TEXT NOT NULL,
    "companionType" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_surveys_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "users" ADD COLUMN "surveyId" TEXT;

CREATE UNIQUE INDEX "users_surveyId_key" ON "users"("surveyId");

ALTER TABLE "users" ADD CONSTRAINT "users_surveyId_fkey"
FOREIGN KEY ("surveyId") REFERENCES "user_surveys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
