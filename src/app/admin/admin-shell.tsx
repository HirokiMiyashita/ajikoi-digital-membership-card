"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MdFace, MdInsertChart, MdLogout, MdMenu, MdSend } from "react-icons/md";

import { adminAuthClient } from "@/lib/admin-auth-client";

const navItems = [
  { href: "/admin/report", label: "レポート", icon: MdInsertChart },
  { href: "/admin/spot-delivery", label: "LINE配信", icon: MdSend },
  { href: "/admin/members", label: "会員情報", icon: MdFace },
  { href: "/admin/menu", label: "メニュー", icon: MdMenu },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type AdminShellProps = {
  children: React.ReactNode;
  currentUser: {
    name: string;
    image: string | null;
  } | null;
};

export default function AdminShell({ children, currentUser }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const hideNavigation =
    pathname === "/admin/login" ||
    pathname === "/admin/signup" ||
    pathname === "/admin/setup" ||
    pathname === "/admin/onboarding";
  const userName = currentUser?.name || "ユーザー";
  const initial = userName.slice(0, 1).toUpperCase();

  const handleSignOut = async () => {
    await adminAuthClient.signOut();
    router.replace("/admin/login");
    router.refresh();
  };

  if (hideNavigation) {
    return <div className="min-h-dvh bg-[#f6f8fb] text-[#0f172a]">{children}</div>;
  }

  return (
    <div className="h-svh overflow-hidden bg-[#f6f8fb] text-[#0f172a] md:h-auto md:min-h-dvh md:overflow-visible">
      <aside className="fixed inset-y-0 left-0 hidden w-[240px] flex-col border-r border-[#dbe2ea] bg-white p-4 md:flex">
        <p className="mb-4 text-lg font-bold">管理画面</p>
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={`block rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  active ? "bg-[#0f766e] text-white" : "text-[#334155] hover:bg-[#f1f5f9]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        {currentUser ? (
          <div className="flex items-center gap-3 border-t border-[#e2e8f0] pt-4">
            {currentUser.image ? (
              <span
                role="img"
                aria-label={`${userName}のアバター`}
                className="h-9 w-9 shrink-0 rounded-full bg-cover bg-center"
                style={{ backgroundImage: `url(${JSON.stringify(currentUser.image)})` }}
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ccfbf1] text-sm font-bold text-[#0f766e]"
              >
                {initial}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#334155]">
              {userName}
            </span>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              aria-label="サインアウト"
              title="サインアウト"
              className="rounded-lg p-2 text-[#64748b] transition-colors hover:bg-[#f1f5f9] hover:text-[#dc2626]"
            >
              <MdLogout size={20} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </aside>

      <div className="h-full overflow-y-auto overscroll-y-contain pb-[calc(4rem+env(safe-area-inset-bottom))] md:ml-[240px] md:h-auto md:min-h-dvh md:overflow-visible md:pb-0">
        {children}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dbe2ea] bg-white md:hidden">
        <ul className="grid grid-cols-4">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch
                  className={`flex flex-col items-center justify-center gap-0.5 px-2 py-2 text-center text-xs font-semibold ${
                    active ? "text-[#0f766e]" : "text-[#64748b]"
                  }`}
                >
                  <Icon size={19} aria-hidden="true" />
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
