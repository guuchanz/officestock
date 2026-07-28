"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { deleteProjectAction, type ProjectListRow } from "@/actions/project.actions";
import { ProjectStatusBadge, ProjectPriorityBadge } from "./ProjectStatusBadge";
import ProgressBar from "./ProgressBar";

const money = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ProjectRow({
  project,
  canDelete,
}: {
  project: ProjectListRow;
  canDelete: boolean;
}) {
  const t = useTranslations("Projects");
  const [pending, start] = useTransition();

  function onDelete() {
    if (!confirm(t("confirmDelete", { name: project.name }))) return;
    start(async () => {
      const res = await deleteProjectAction(project.id);
      if (!res.success) alert(res.message);
    });
  }

  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50">
      <td className="px-5 py-3 font-medium text-slate-700 whitespace-nowrap">
        <Link href={`/projects/${project.id}`} className="hover:underline">{project.code}</Link>
      </td>
      <td className="px-4 py-3">
        <Link href={`/projects/${project.id}`} className="hover:underline">{project.name}</Link>
        {project.atRisk && (
          <AlertTriangle size={14} className="inline ml-1.5 -mt-0.5 text-orange-500" aria-label={t("atRisk")} />
        )}
      </td>
      <td className="px-4 py-3 text-slate-500">{project.departmentName ?? "-"}</td>
      <td className="px-4 py-3 text-slate-500">{project.ownerName ?? "-"}</td>
      <td className="px-4 py-3"><ProjectPriorityBadge priority={project.priority} /></td>
      <td className="px-4 py-3"><ProjectStatusBadge status={project.status} /></td>
      <td className="px-4 py-3"><ProgressBar value={project.progress} /></td>
      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
        {project.dueDate ? project.dueDate.toLocaleDateString("th-TH") : "-"}
      </td>
      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{money(project.actualCost)}</td>
      <td className="px-4 py-3 text-right">
        {canDelete && (
          <button onClick={onDelete} disabled={pending}
                  className="text-slate-400 hover:text-red-600 disabled:opacity-40"
                  aria-label={t("delete")}>
            <Trash2 size={16} />
          </button>
        )}
      </td>
    </tr>
  );
}
