import Link from "next/link";
import { getDashboardStats } from "@/actions/stock.actions";
import { getProducts } from "@/actions/product.actions";
import { getDepartments } from "@/actions/department.actions";
import { getRepairDashboardStats } from "@/actions/repair.actions";
import { getMaintenanceDashboardStats } from "@/actions/equipment.actions";
import MetricCard from "@/components/dashboard/MetricCard";
import StockTable from "@/components/dashboard/StockTable";
import { Package, AlertTriangle, TrendingDown, TrendingUp, Wrench, Clock, CalendarClock } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

export const revalidate = 0;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const search = params.q;

  const [stats, repairStats, maintStats, products, departments, t, locale] = await Promise.all([
    getDashboardStats(),
    getRepairDashboardStats(),
    getMaintenanceDashboardStats(),
    getProducts(search),
    getDepartments(),
    getTranslations("Dashboard"),
    getLocale(),
  ]);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {new Date().toLocaleDateString(locale === "en" ? "en-US" : "th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard
          label={t("totalProducts")}
          value={stats.totalProducts}
          icon={<Package size={20} />}
          color="indigo"
        />
        <MetricCard
          label={t("lowStock")}
          value={stats.lowStockProducts}
          icon={<AlertTriangle size={20} />}
          color="rose"
        />
        <MetricCard
          label={t("importedToday")}
          value={`+${stats.todayIn}`}
          icon={<TrendingUp size={20} />}
          color="emerald"
        />
        <MetricCard
          label={t("withdrawnToday")}
          value={`-${stats.todayOut}`}
          icon={<TrendingDown size={20} />}
          color="amber"
        />
        <Link href="/repairs">
          <MetricCard
            label={t("openRepairs")}
            value={repairStats.open}
            icon={<Wrench size={20} />}
            color="indigo"
          />
        </Link>
        <Link href="/repairs">
          <MetricCard
            label={t("overdueRepairs")}
            value={repairStats.overdue}
            icon={<Clock size={20} />}
            color="rose"
          />
        </Link>
        <Link href="/maintenance?bucket=OVERDUE">
          <MetricCard
            label={t("overdueMaintenance")}
            value={maintStats.overdue}
            icon={<CalendarClock size={20} />}
            color="amber"
          />
        </Link>
      </div>

      {/* Stock Table */}
      <StockTable products={products} departments={departments} search={search} />
    </div>
  );
}
