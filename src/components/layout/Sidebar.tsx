"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, History, PackagePlus, Package } from "lucide-react";
import { clsx } from "clsx";

const nav = [
  { href: "/dashboard",     label: "ภาพรวม",         icon: LayoutDashboard },
  { href: "/products",      label: "สินค้าคงคลัง",   icon: Package },
  { href: "/transactions",  label: "ประวัติรายการ",   icon: History },
  { href: "/products/new",  label: "เพิ่มสินค้าใหม่", icon: PackagePlus },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside className="flex w-60 flex-col bg-[#1e3a5f] text-white shrink-0">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-white/10">
        <span className="text-2xl">📦</span>
        <div>
          <p className="font-bold text-sm leading-tight">Office Stock</p>
          <p className="text-[11px] text-blue-200">IT Asset Management</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-blue-100 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/10">
        <p className="text-[11px] text-blue-300 text-center">v1.0.0 © Office Stock</p>
      </div>
    </aside>
  );
}
