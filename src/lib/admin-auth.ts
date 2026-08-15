import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

/**
 * Compatibility facade while admin API routes migrate from better-auth.
 * Authentication is fully handled by Supabase Auth.
 */
export const adminAuth = {
  api: {
    async getSession(_options?: { headers?: Headers }) {
      void _options;
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getClaims();
      const authUserId = data?.claims?.sub;
      if (error || !authUserId) {
        return null;
      }

      const adminUser = await prisma.adminUser.findUnique({
        where: { id: authUserId },
      });
      if (!adminUser?.officialAccountId) {
        return null;
      }

      const metadata = data.claims.user_metadata as
        | { display_name?: string; full_name?: string; avatar_url?: string }
        | undefined;

      return {
        user: {
          id: adminUser.id,
          username: adminUser.id,
          name:
            adminUser.displayName ??
            metadata?.display_name ??
            metadata?.full_name ??
            adminUser.email ??
            "ユーザー",
          image: adminUser.avatarUrl ?? metadata?.avatar_url ?? null,
          email: adminUser.email ?? data.claims.email ?? "",
        },
      };
    },
  },
};
