import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUsers } from "@/actions/user.actions";
import UserForm from "@/components/users/UserForm";
import UserRow from "@/components/users/UserRow";
import { getTranslations } from "next-intl/server";

export const revalidate = 0;

export default async function UsersPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN" && role !== "MODERATOR") redirect("/dashboard");
  const canManage = role === "ADMIN";

  const [users, t] = await Promise.all([getUsers(), getTranslations("Users")]);

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{t("subtitle")}</p>
      </div>

      <div className="card p-6">
        <UserForm restrictToStaff={!canManage} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">{t("colName")}</th>
                <th className="px-4 py-3 font-medium">{t("colEmail")}</th>
                <th className="px-4 py-3 font-medium">{t("colRole")}</th>
                <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
                <th className="px-4 py-3 font-medium">{t("colCreated")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                    {t("empty")}
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <UserRow key={u.id} user={u} isSelf={u.id === session!.user!.id} canManage={canManage} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
