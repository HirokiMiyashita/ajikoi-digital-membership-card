import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";

import { prisma } from "@/lib/prisma";

export const adminAuth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-only-secret-change-me",
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    modelName: "AdminAuthUser",
  },
  session: {
    modelName: "AdminAuthSession",
  },
  account: {
    modelName: "AdminAuthAccount",
  },
  verification: {
    modelName: "AdminAuthVerification",
  },
  plugins: [username()],
});
