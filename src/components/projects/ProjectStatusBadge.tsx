import { ProjectStatus, ProjectPriority } from "@prisma/client";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";

const STATUS_STYLES: Record<ProjectStatus, string> = {
  PLANNING:    "bg-indigo-100 text-indigo-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  ON_HOLD:     "bg-slate-200 text-slate-600",
  DONE:        "bg-emerald-100 text-emerald-700",
  CANCELLED:   "bg-red-100 text-red-700",
};

const PRIORITY_STYLES: Record<ProjectPriority, string> = {
  LOW:    "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH:   "bg-orange-100 text-orange-700",
};

const PILL = "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap";

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const t = useTranslations("Projects");
  return <span className={clsx(PILL, STATUS_STYLES[status])}>{t(`status${status}`)}</span>;
}

export function ProjectPriorityBadge({ priority }: { priority: ProjectPriority }) {
  const t = useTranslations("Projects");
  return <span className={clsx(PILL, PRIORITY_STYLES[priority])}>{t(`priority${priority}`)}</span>;
}
