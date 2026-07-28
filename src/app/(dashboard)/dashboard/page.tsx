import { getDashboardStats } from "@/actions/stock.actions";
import { getProducts } from "@/actions/product.actions";
import { getDepartments } from "@/actions/department.actions";
import MetricCard from "@/components/dashboard/MetricCard";
import StockTable from "@/components/dashboard/StockTable";
import { Package, AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

export const revalidate = 0;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const search = params.q;

  const [stats, products, departments, t, locale] = await Promise.all([
    getDashboardStats(),
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

      {/* Metric Cards — stock only; repair/maintenance status lives on their
          own overview pages now. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
      </div>

      {/* Stock Table */}
      <StockTable products={products} departments={departments} search={search} />
    </div>
  );
}
