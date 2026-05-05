import AdminShell from "./admin-shell";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminShell>{children}</AdminShell>;
}
