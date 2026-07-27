"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import LanguageSwitcher from "./LanguageSwitcher";
import { moduleForPath, activeHref } from "@/lib/navigation";

interface SidebarProps {
  canManageUsers: boolean;
}

export default function Sidebar({ canManageUsers }: SidebarProps) {
  const path = usePathname();
  const t = useTranslations("Nav");
  const mod = moduleForPath(path);
  const items = mod.items.filter((i) => !i.adminOnly || canManageUsers);
  const current = activeHref(path, items.map((i) => i.href));
  const ModIcon = mod.icon;

  return (
    <aside className="flex w-60 flex-col bg-[#1e3a5f] text-white shrink-0">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-white/10">
        <ModIcon size={22} className="text-blue-200" />
        <div>
          <p className="font-bold text-sm leading-tight">{t(mod.labelKey)}</p>
          <p className="text-[11px] text-blue-200">IT Asset Management</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {items.map(({ href, key, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              href === current
                ? "bg-white/20 text-white shadow-sm"
                : "text-blue-100 hover:bg-white/10 hover:text-white"
            )}
          >
            <Icon size={17} />
            {t(key)}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/10 space-y-3">
        <LanguageSwitcher />
        <p className="text-[11px] text-blue-300 text-center">v1.0.0 © Office Stock</p>
      </div>
    </aside>
  );
}
