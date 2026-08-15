import type { Metadata } from "next";
import { adminAuth } from "@/lib/admin-auth";
import AdminShell from "./admin-shell";

export const metadata: Metadata = {
  title: "店舗管理 | デジタル会員証",
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "店舗管理",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/favicon.ico" }],
    apple: [{ url: "/favicon.ico" }],
  },
};

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await adminAuth.api.getSession();

  return (
    <AdminShell
      currentUser={
        session
          ? {
              name: session.user.name,
              image: session.user.image ?? null,
            }
          : null
      }
    >
      {children}
    </AdminShell>
  );
}
