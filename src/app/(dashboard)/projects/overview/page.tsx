import Link from "next/link";
import { AlertTriangle, CalendarClock, FolderKanban, CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getProjectStats, getProjects } from "@/actions/project.actions";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";
import ProgressBar from "@/components/projects/ProgressBar";

export const revalidate = 0;

const money = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function ProjectOverviewPage() {
  const [stats, all, t] = await Promise.all([
    getProjectStats(),
    getProjects({}),
    getTranslations("ProjectOverview"),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const attention = all.filter(
    (p) =>
      p.status !== "DONE" &&
      p.status !== "CANCELLED" &&
      (p.atRisk || (p.dueDate !== null && p.dueDate < today))
  );

  const cards = [
    { key: "open",         value: String(stats.open),         icon: FolderKanban,  tone: "text-[#1e3a5f]" },
    { key: "overdue",      value: String(stats.overdue),      icon: CalendarClock, tone: "text-red-600" },
    { key: "atRisk",       value: String(stats.atRisk),       icon: AlertTriangle, tone: "text-orange-600" },
    { key: "doneThisYear", value: String(stats.doneThisYear), icon: CheckCircle2,  tone: "text-emerald-600" },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.key} className="card p-4 flex items-center gap-3">
              <Icon size={22} className={c.tone} />
              <div>
                <p className="text-xs text-slate-500">{t(c.key)}</p>
                <p className="text-xl font-bold text-slate-900">{c.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-xs text-slate-500">{t("budgetTotal")}</p>
          <p className="text-lg font-bold text-slate-900 tabular-nums">{money(stats.budgetTotal)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">{t("actualTotal")}</p>
          <p className="text-lg font-bold text-slate-900 tabular-nums">{money(stats.actualTotal)}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">{t("needsAttention")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {attention.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-5 py-3">
                    <Link href={`/projects/${p.id}`} className="hover:underline font-medium">{p.name}</Link>
                    <span className="text-xs text-slate-400 ml-2">{p.code}</span>
                  </td>
                  <td className="px-4 py-3"><ProjectStatusBadge status={p.status} /></td>
                  <td className="px-4 py-3"><ProgressBar value={p.progress} /></td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {p.dueDate ? p.dueDate.toLocaleDateString("th-TH") : "-"}
                  </td>
                </tr>
              ))}
              {attention.length === 0 && (
                <tr><td className="px-5 py-8 text-center text-slate-400">{t("allClear")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
