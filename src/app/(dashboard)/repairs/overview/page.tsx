import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { RepairStatus } from "@prisma/client";
import { getRepairDashboardStats, getRepairJobs } from "@/actions/repair.actions";
import { OVERDUE_DAYS } from "@/lib/repair-constants";
import RepairStatusBadge from "@/components/repairs/RepairStatusBadge";

export const revalidate = 0;

export default async function RepairOverviewPage() {
  const [stats, recent, t] = await Promise.all([
    getRepairDashboardStats(),
    getRepairJobs({}),
    getTranslations("RepairOverview"),
  ]);

  const money = (n: number) =>
    n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const cards = [
    { key: "open",      value: String(stats.open),                            tone: "text-slate-900" },
    { key: "overdue",   value: String(stats.overdue),                         tone: stats.overdue > 0 ? "text-amber-600" : "text-slate-900" },
    { key: "done",      value: String(stats.byStatus[RepairStatus.DONE]),     tone: "text-emerald-600" },
    { key: "monthCost", value: money(stats.monthCost),                        tone: "text-slate-900" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{t("subtitle", { days: OVERDUE_DAYS })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.key} className="card p-5">
            <p className="text-xs uppercase tracking-wide text-slate-400">{t(`card_${c.key}`)}</p>
            <p className={`mt-1 text-2xl font-bold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">{t("recentTitle")}</h2>
          <Link href="/repairs" className="text-xs font-medium text-blue-600 hover:underline">{t("viewAll")}</Link>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {recent.length === 0 && (
              <tr><td className="py-12 text-center text-slate-400 text-sm">{t("empty")}</td></tr>
            )}
            {recent.slice(0, 8).map((job) => (
              <tr key={job.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{job.jobNumber}</td>
                <td className="px-4 py-3">
                  <Link href={`/repairs/${job.id}/edit`} className="font-medium text-slate-800 hover:text-blue-600">
                    {job.deviceName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{job.technician?.name ?? "-"}</td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                  {new Date(job.reportedAt).toLocaleDateString("th-TH")}
                </td>
                <td className="px-5 py-3 text-right"><RepairStatusBadge status={job.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
