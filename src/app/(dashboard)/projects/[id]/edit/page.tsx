import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getProject } from "@/actions/project.actions";
import ProjectForm from "@/components/projects/ProjectForm";

export const revalidate = 0;

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId)) notFound();

  const [project, departments, users, t] = await Promise.all([
    getProject(projectId),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    getTranslations("Projects"),
  ]);
  if (!project) notFound();

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">{t("editTitle", { code: project.code })}</h1>
      <ProjectForm
        departments={departments}
        users={users.map((u) => ({ id: u.id, label: u.name ?? u.email }))}
        project={project}
      />
    </div>
  );
}
