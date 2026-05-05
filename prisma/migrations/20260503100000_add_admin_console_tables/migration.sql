CREATE TABLE "admin_user" (
    "id" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_user_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_auth_user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "username" TEXT,
    "displayUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_auth_user_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_auth_session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "admin_auth_session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_auth_account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_auth_account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_auth_verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "admin_auth_verification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_auth_user_email_key" ON "admin_auth_user"("email");
CREATE UNIQUE INDEX "admin_auth_user_username_key" ON "admin_auth_user"("username");
CREATE UNIQUE INDEX "admin_auth_session_token_key" ON "admin_auth_session"("token");
CREATE INDEX "admin_auth_session_userId_idx" ON "admin_auth_session"("userId");
CREATE INDEX "admin_auth_account_userId_idx" ON "admin_auth_account"("userId");

ALTER TABLE "admin_auth_session" ADD CONSTRAINT "admin_auth_session_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "admin_auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_auth_account" ADD CONSTRAINT "admin_auth_account_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "admin_auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
