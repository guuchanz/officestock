import Link from "next/link";
import { HardHat, Clock, CalendarClock, CalendarCheck, CheckCircle2, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getMaintenanceDashboardStats, getEquipmentList } from "@/actions/equipment.actions";
import { DUE_SOON_DAYS } from "@/lib/maintenance-constants";
import DueBadge from "@/components/maintenance/DueBadge";
import MetricCard from "@/components/dashboard/MetricCard";

export const revalidate = 0;

export default async function MaintenanceOverviewPage() {
  const [stats, urgent, t] = await Promise.all([
    getMaintenanceDashboardStats(),
    getEquipmentList({ bucket: "OVERDUE" }),
    getTranslations("MaintenanceOverview"),
  ]);

  const money = (n: number) =>
    n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // "overdue" matches the stock dashboard's overdueMaintenance card exactly
  // (same icon, same color), so the same metric reads identically in both
  // places.
  const cards = [
    { key: "total",     value: String(stats.total),     icon: HardHat,       color: "indigo" as const },
    { key: "overdue",   value: String(stats.overdue),   icon: CalendarClock, color: "amber" as const },
    { key: "dueSoon",   value: String(stats.dueSoon),   icon: Clock,         color: "indigo" as const },
    { key: "scheduled", value: String(stats.scheduled), icon: CalendarCheck, color: "emerald" as const },
    { key: "doneMonth", value: String(stats.doneThisMonth), icon: CheckCircle2, color: "emerald" as const },
    { key: "monthCost", value: money(stats.monthCost),  icon: Wallet,        color: "amber" as const },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{t("subtitle", { days: DUE_SOON_DAYS })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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
