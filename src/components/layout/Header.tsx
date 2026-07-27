import { signOut } from "@/lib/auth";
import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import ModuleTabs from "./ModuleTabs";

interface HeaderProps {
  user?: { name?: string | null; email?: string | null };
}

export default async function Header({ user }: HeaderProps) {
  const t = await getTranslations("Header");

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shrink-0">
      <ModuleTabs />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-800">{user?.name ?? t("defaultUser")}</p>
          <p className="text-xs text-slate-400">{user?.email}</p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <LogOut size={14} />
            {t("logout")}
          </button>
        </form>
      </div>
    </header>
  );
}
