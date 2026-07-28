import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getProjects } from "@/actions/project.actions";
import ProjectFilters from "@/components/projects/ProjectFilters";
import ProjectRow from "@/components/projects/ProjectRow";

export const revalidate = 0;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; priority?: string; departmentId?: string; ownerId?: string }>;
}) {
  const params = await searchParams;
  const [projects, departments, users, t, session] = await Promise.all([
    getProjects(params),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    getTranslations("Projects"),
    auth(),
  ]);
  const canDelete = (session?.user as any)?.role === "ADMIN";
  const currentUserId = session?.user?.id ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t("itemsCount", { count: projects.length })}</p>
        </div>
        <Link href="/projects/new" className="btn-primary">
          <PlusCircle size={16} />
          {t("addNew")}
        </Link>
      </div>

      <div className="card overflow-hidden">
        <ProjectFilters
          departments={departments}
          owners={users.map((u) => ({ id: u.id, label: u.name ?? u.email }))}
          currentUserId={currentUserId}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">{t("colCode")}</th>
                <th className="px-4 py-3 font-medium">{t("colName")}</th>
                <th className="px-4 py-3 font-medium">{t("colDepartment")}</th>
                <th className="px-4 py-3 font-medium">{t("colRequestor")}</th>
                <th className="px-4 py-3 font-medium">{t("colOwner")}</th>
                <th className="px-4 py-3 font-medium">{t("colPriority")}</th>
                <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
                <th className="px-4 py-3 font-medium">{t("colProgress")}</th>
                <th className="px-4 py-3 font-medium">{t("colDueDate")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("colActualCost")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <ProjectRow key={p.id} project={p} canDelete={canDelete} />
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-5 py-10 text-center text-slate-400">
                    {t("empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
