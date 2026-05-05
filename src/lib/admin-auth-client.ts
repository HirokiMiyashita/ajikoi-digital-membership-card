"use client";

import { createAuthClient } from "better-auth/client";
import { usernameClient } from "better-auth/client/plugins";

export const adminAuthClient = createAuthClient({
  plugins: [usernameClient()],
});
