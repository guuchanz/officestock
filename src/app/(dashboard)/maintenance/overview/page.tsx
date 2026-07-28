import Link from "next/link";
import { HardHat, Clock, CalendarClock, CalendarCheck, CheckCircle2, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getMaintenanceDashboardStats, getEquipmentList } from "@/actions/equipment.actions";
import { DUE_SOON_DAYS } from "@/lib/maintenance-constants";
import DueBadge from "@/components/maintenance/DueBadge";

export const revalidate = 0;

export default async function MaintenanceOverviewPage() {
  const [stats, urgent, t] = await Promise.all([
    getMaintenanceDashboardStats(),
    getEquipmentList({ bucket: "OVERDUE" }),
    getTranslations("MaintenanceOverview"),
  ]);

  const money = (n: number) =>
    n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const cards = [
    { key: "total",     value: String(stats.total),     icon: HardHat,      tone: "text-[#1e3a5f]" },
    { key: "overdue",   value: String(stats.overdue),   icon: Clock,        tone: stats.overdue > 0 ? "text-red-600" : "text-slate-900" },
    { key: "dueSoon",   value: String(stats.dueSoon),   icon: CalendarClock, tone: stats.dueSoon > 0 ? "text-amber-600" : "text-slate-900" },
    { key: "scheduled", value: String(stats.scheduled), icon: CalendarCheck, tone: "text-emerald-600" },
    { key: "doneMonth", value: String(stats.doneThisMonth), icon: CheckCircle2, tone: "text-slate-900" },
    { key: "monthCost", value: money(stats.monthCost),  icon: Wallet,       tone: "text-slate-900" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{t("subtitle", { days: DUE_SOON_DAYS })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.key} className="card p-5 flex items-center gap-3">
              <Icon size={22} className={c.tone} />
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">{t(`card_${c.key}`)}</p>
                <p className={`mt-1 text-2xl font-bold ${c.tone}`}>{c.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">{t("overdueTitle")}</h2>
          <Link href="/maintenance" className="text-xs font-medium text-blue-600 hover:underline">{t("viewAll")}</Link>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {urgent.length === 0 && (
              <tr><td className="py-12 text-center text-slate-400 text-sm">{t("empty")}</td></tr>
            )}
            {urgent.slice(0, 10).map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{item.assetNo}</td>
                <td className="px-4 py-3">
                  <Link href={`/maintenance/${item.id}`} className="font-medium text-slate-800 hover:text-blue-600">
                    {item.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{item.factory?.name ?? "-"}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{item.technician?.name ?? "-"}</td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                  {new Date(item.nextDueAt).toLocaleDateString("th-TH")}
                </td>
                <td className="px-5 py-3 text-right">
                  <DueBadge bucket={item.bucket} remaining={item.remaining} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
