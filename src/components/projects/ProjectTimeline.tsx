import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import type { ProjectDetail } from "@/actions/project.actions";

const DAY = 24 * 60 * 60 * 1000;

export default function ProjectTimeline({ project }: { project: ProjectDetail }) {
  const t = useTranslations("ProjectTimeline");
  const dated = project.milestones.filter((m) => m.startDate && m.endDate);
  const undated = project.milestones.filter((m) => !m.startDate || !m.endDate);

  if (project.milestones.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">{t("noMilestones")}</p>;
  }

  // Window spans the project dates plus every dated milestone, so a milestone
  // running past the due date is still fully visible.
  const starts = [project.startDate, ...dated.map((m) => m.startDate!)];
  const ends = [
    ...(project.dueDate ? [project.dueDate] : []),
    ...dated.map((m) => m.endDate!),
    project.startDate,
  ];
  const min = new Date(Math.min(...starts.map((d) => d.getTime())));
  const max = new Date(Math.max(...ends.map((d) => d.getTime())));
  const totalDays = Math.max(1, Math.round((max.getTime() - min.getTime()) / DAY) + 1);

  return (
    <div className="space-y-2">
      {dated.map((m) => {
        const offset = Math.round((m.startDate!.getTime() - min.getTime()) / DAY);
        const span = Math.max(1, Math.round((m.endDate!.getTime() - m.startDate!.getTime()) / DAY) + 1);
        return (
          <div key={m.id} className="grid grid-cols-[10rem_1fr_9rem] items-center gap-3 text-sm">
            <span className={clsx("truncate", m.isDone ? "text-slate-400 line-through" : "text-slate-700")}>
              {m.name}
            </span>
            {/* Hidden on small screens: bars are unreadable below ~640px. */}
            <div className="hidden sm:grid h-5" style={{ gridTemplateColumns: `repeat(${totalDays}, minmax(0, 1fr))` }}>
              <div
                className={clsx("rounded-full h-2 self-center", m.isDone ? "bg-emerald-500" : "bg-[#1e3a5f]")}
                style={{ gridColumn: `${offset + 1} / span ${span}` }}
              />
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap text-right">
              {m.startDate!.toLocaleDateString("th-TH")} – {m.endDate!.toLocaleDateString("th-TH")}
            </span>
          </div>
        );
      })}

      {undated.map((m) => (
        <div key={m.id} className="grid grid-cols-[10rem_1fr_9rem] items-center gap-3 text-sm">
          <span className={clsx("truncate", m.isDone ? "text-slate-400 line-through" : "text-slate-700")}>
            {m.name}
          </span>
          <span className="hidden sm:block text-xs text-slate-300 italic">{t("noDates")}</span>
          <span className="text-xs text-slate-400 text-right">—</span>
        </div>
      ))}
    </div>
  );
}
