import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/actions/project.actions";
import { ProjectStatusBadge, ProjectPriorityBadge } from "@/components/projects/ProjectStatusBadge";
import ProgressBar from "@/components/projects/ProgressBar";
import ProjectStatusSelect from "@/components/projects/ProjectStatusSelect";
import ProjectTimeline from "@/components/projects/ProjectTimeline";
import MilestoneEditor from "@/components/projects/MilestoneEditor";
import UpdateLog from "@/components/projects/UpdateLog";
import ProjectAttachments from "@/components/projects/ProjectAttachments";

export const revalidate = 0;

const money = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId)) notFound();

  const [project, t] = await Promise.all([
    getProject(projectId),
    getTranslations("Projects"),
  ]);
  if (!project) notFound();

  const variance = project.budget - project.actualCost;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">{project.code}</p>
          <h1 className="text-xl font-bold text-slate-900">{project.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <ProjectStatusBadge status={project.status} />
            <ProjectPriorityBadge priority={project.priority} />
            {project.atRisk && (
              <span className="rounded-full bg-orange-100 text-orange-700 px-2.5 py-0.5 text-xs font-semibold">
                {t("atRisk")}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ProjectStatusSelect id={project.id} status={project.status} />
          <Link href={`/projects/${project.id}/edit`} className="btn-primary">
            <Pencil size={15} />{t("edit")}
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs text-slate-500">{t("colProgress")}</p>
          <div className="mt-2"><ProgressBar value={project.progress} /></div>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">{t("colBudget")}</p>
          <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">{money(project.budget)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">{t("colActualCost")}</p>
          <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">{money(project.actualCost)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">{t("variance")}</p>
          <p className={`text-lg font-bold mt-1 tabular-nums ${variance < 0 ? "text-red-600" : "text-emerald-600"}`}>
            {money(variance)}
          </p>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-slate-900">{t("sectionDetails")}</h2>
        <dl className="grid gap-3 sm:grid-cols-3 text-sm">
          <div><dt className="text-slate-500">{t("colDepartment")}</dt><dd>{project.departmentName ?? "-"}</dd></div>
          <div><dt className="text-slate-500">{t("colRequestor")}</dt><dd>{project.requestor ?? "-"}</dd></div>
          <div><dt className="text-slate-500">{t("colOwner")}</dt><dd>{project.ownerName ?? "-"}</dd></div>
          <div><dt className="text-slate-500">{t("colStartDate")}</dt><dd>{project.startDate.toLocaleDateString("th-TH")}</dd></div>
          <div><dt className="text-slate-500">{t("colDueDate")}</dt><dd>{project.dueDate?.toLocaleDateString("th-TH") ?? "-"}</dd></div>
          <div><dt className="text-slate-500">{t("colFinishedAt")}</dt><dd>{project.finishedAt?.toLocaleDateString("th-TH") ?? "-"}</dd></div>
        </dl>
        {project.details && <p className="text-sm text-slate-700 whitespace-pre-wrap pt-2">{project.details}</p>}
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-slate-900">{t("sectionTimeline")}</h2>
        <ProjectTimeline project={project} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">{t("sectionMilestones")}</h2>
          <MilestoneEditor project={project} />
        </div>
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">{t("sectionFiles")}</h2>
          <ProjectAttachments project={project} />
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-slate-900">{t("sectionUpdates")}</h2>
        <UpdateLog project={project} />
      </div>
    </div>
  );
}
