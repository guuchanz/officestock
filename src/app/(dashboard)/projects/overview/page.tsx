import Link from "next/link";
import { AlertTriangle, CalendarClock, FolderKanban, CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getProjectStats, getProjects } from "@/actions/project.actions";
import { auth } from "@/lib/auth";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";
import ProgressBar from "@/components/projects/ProgressBar";
import MetricCard from "@/components/dashboard/MetricCard";
import OwnerScopeToggle from "@/components/projects/OwnerScopeToggle";

export const revalidate = 0;

const money = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function ProjectOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ ownerId?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const currentUserId = session?.user?.id ?? null;

  // Same default-to-me behaviour as the project list: no ownerId in the URL
  // means "my projects"; ?ownerId=all is the explicit way to see everyone's.
  const effectiveOwnerId =
    params.ownerId === "all" ? null : (params.ownerId || currentUserId);
  const isMine = effectiveOwnerId !== null && effectiveOwnerId === currentUserId;

  const [stats, all, t] = await Promise.all([
    getProjectStats({ ownerId: effectiveOwnerId ?? undefined }),
    getProjects({ ownerId: effectiveOwnerId ?? undefined }),
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

  // "overdue" mirrors the stock dashboard's overdueMaintenance card (both are
  // due-date driven); "atRisk" copies the icon+color of stock's lowStock
  // card exactly, since both mean "needs attention now".
  const cards = [
    { key: "open",         value: String(stats.open),         icon: FolderKanban,  color: "indigo" as const },
    { key: "overdue",      value: String(stats.overdue),      icon: CalendarClock, color: "amber" as const },
    { key: "atRisk",       value: String(stats.atRisk),       icon: AlertTriangle, color: "rose" as const },
    { key: "doneThisYear", value: String(stats.doneThisYear), icon: CheckCircle2,  color: "emerald" as const },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
        {currentUserId && <OwnerScopeToggle isMine={isMine} basePath="/projects/overview" />}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <MetricCard
            key={c.key}
            label={t(c.key)}
            value={c.value}
            icon={<c.icon size={20} />}
            color={c.color}
          />
        ))}
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
