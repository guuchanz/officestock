import {
  LayoutDashboard, History, Package, FileBarChart, Building2,
  Users, FileText, Tags, Wrench, ClipboardList, PlusCircle, UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  key: string;
  icon: LucideIcon;
  /** Rendered only when the signed-in user can manage users. */
  adminOnly?: boolean;
}

export interface NavModule {
  key: "stock" | "repair";
  labelKey: string;
  href: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const MODULES: NavModule[] = [
  {
    key: "stock",
    labelKey: "moduleStock",
    href: "/dashboard",
    icon: Package,
    items: [
      { href: "/dashboard",    key: "overview",     icon: LayoutDashboard },
      { href: "/products",     key: "products",     icon: Package },
      { href: "/quotations",   key: "quotations",   icon: FileText },
      { href: "/transactions", key: "transactions", icon: History },
      { href: "/reports",      key: "reports",      icon: FileBarChart },
      { href: "/categories",   key: "categories",   icon: Tags },
      { href: "/departments",  key: "departments",  icon: Building2 },
      { href: "/users",        key: "users",        icon: Users, adminOnly: true },
    ],
  },
  {
    key: "repair",
    labelKey: "moduleRepair",
    href: "/repairs/overview",
    icon: Wrench,
    items: [
      { href: "/repairs/overview",    key: "repairOverview", icon: LayoutDashboard },
      { href: "/repairs",             key: "repairList",     icon: ClipboardList },
      { href: "/repairs/new",         key: "repairNew",      icon: PlusCircle },
      { href: "/repairs/technicians",  key: "technicians",   icon: UserCog },
      { href: "/repairs/device-types", key: "deviceTypes",   icon: Tags },
      { href: "/repairs/reports",      key: "repairReports", icon: FileBarChart },
    ],
  },
];

/**
 * Longest matching prefix wins, so `/repairs/new` selects "New Repair"
 * rather than "Repair List", and `/repairs/7/edit` selects "Repair List".
 */
export function activeHref(path: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (path === href || path.startsWith(`${href}/`)) {
      if (best === null || href.length > best.length) best = href;
    }
  }
  return best;
}

export function moduleForPath(path: string): NavModule {
  let bestModule: NavModule | null = null;
  let bestLength = -1;
  for (const mod of MODULES) {
    for (const item of mod.items) {
      if (path === item.href || path.startsWith(`${item.href}/`)) {
        if (item.href.length > bestLength) {
          bestLength = item.href.length;
          bestModule = mod;
        }
      }
    }
  }
  return bestModule ?? MODULES[0];
}
