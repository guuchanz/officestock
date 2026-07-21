import { signOut } from "@/lib/auth";
import { LogOut } from "lucide-react";

interface HeaderProps {
  user?: { name?: string | null; email?: string | null };
}

export default function Header({ user }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shrink-0">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-800">{user?.name ?? "ผู้ใช้"}</p>
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
            ออกจากระบบ
          </button>
        </form>
      </div>
    </header>
  );
}
