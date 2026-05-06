"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin/report", label: "レポート" },
  { href: "/admin/spot-delivery", label: "スポット配信" },
  { href: "/admin/members", label: "会員情報" },
  { href: "/admin/menu", label: "メニュー" },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNavigation = pathname === "/admin/login" || pathname === "/admin/setup";

  if (hideNavigation) {
    return <div className="min-h-screen bg-[#f6f8fb] text-[#0f172a]">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-[#0f172a]">
      <aside className="fixed inset-y-0 left-0 hidden w-[240px] border-r border-[#dbe2ea] bg-white p-4 md:block">
        <p className="mb-4 text-lg font-bold">管理画面</p>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  active ? "bg-[#0f766e] text-white" : "text-[#334155] hover:bg-[#f1f5f9]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-h-screen pb-20 md:ml-[240px] md:pb-0">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dbe2ea] bg-white md:hidden">
        <ul className="grid grid-cols-4">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block px-2 py-3 text-center text-xs font-semibold ${
                    active ? "text-[#0f766e]" : "text-[#64748b]"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
