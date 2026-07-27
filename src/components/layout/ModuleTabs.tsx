"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { MODULES, moduleForPath } from "@/lib/navigation";

export default function ModuleTabs() {
  const path = usePathname();
  const t = useTranslations("Nav");
  const current = moduleForPath(path);

  return (
    <nav className="flex items-center gap-1.5">
      {MODULES.map((mod) => {
        const Icon = mod.icon;
        const active = mod.key === current.key;
        return (
          <Link
            key={mod.key}
            href={mod.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
              active
                ? "bg-[#1e3a5f] text-white"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            )}
          >
            <Icon size={15} />
            {t(mod.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
