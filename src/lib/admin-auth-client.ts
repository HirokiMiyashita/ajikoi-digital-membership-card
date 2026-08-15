"use client";

import { createClient } from "@/lib/supabase/client";

export const adminAuthClient = {
  async signOut() {
    return createClient().auth.signOut();
  },
};
