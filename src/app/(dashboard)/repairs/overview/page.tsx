import Link from "next/link";
import { Wrench, Clock, CheckCircle2, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { RepairStatus } from "@prisma/client";
import { getRepairDashboardStats, getRepairJobs } from "@/actions/repair.actions";
import { OVERDUE_DAYS } from "@/lib/repair-constants";
import RepairStatusBadge from "@/components/repairs/RepairStatusBadge";
import MetricCard from "@/components/dashboard/MetricCard";

export const revalidate = 0;

export default async function RepairOverviewPage() {
  const [stats, recent, t] = await Promise.all([
    getRepairDashboardStats(),
    getRepairJobs({}),
    getTranslations("RepairOverview"),
  ]);

  const money = (n: number) =>
    n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Same icon + color as the matching cards on the stock dashboard
  // (openRepairs, overdueRepairs), so the same metric always looks the same
  // wherever it appears in the app.
  const cards = [
    { key: "open",      value: String(stats.open),                        icon: Wrench,       color: "indigo" as const },
    { key: "overdue",   value: String(stats.overdue),                     icon: Clock,        color: "rose" as const },
    { key: "done",      value: String(stats.byStatus[RepairStatus.DONE]), icon: CheckCircle2, color: "emerald" as const },
    { key: "monthCost", value: money(stats.monthCost),                    icon: Wallet,       color: "amber" as const },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{t("subtitle", { days: OVERDUE_DAYS })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <MetricCard
            key={c.key}
            label={t(`card_${c.key}`)}
            value={c.value}
            icon={<c.icon size={20} />}
            color={c.color}
          />
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
