import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import ProjectForm from "@/components/projects/ProjectForm";

export const revalidate = 0;

export default async function NewProjectPage() {
  const [departments, t] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getTranslations("Projects"),
  ]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">{t("addNew")}</h1>
      <ProjectForm departments={departments} />
    </div>
  );
}
