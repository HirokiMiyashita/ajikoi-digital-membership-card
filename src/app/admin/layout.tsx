import type { Metadata } from "next";

import AdminShell from "./admin-shell";

export const metadata: Metadata = {
  title: "管理画面 | あの味が恋しい。",
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "あじ恋 管理",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/ajikoi-logo.png", sizes: "1024x1024", type: "image/png" }],
    apple: [{ url: "/ajikoi-logo.png", sizes: "1024x1024", type: "image/png" }],
  },
};

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminShell>{children}</AdminShell>;
}
