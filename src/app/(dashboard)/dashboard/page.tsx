import { getDashboardStats } from "@/actions/stock.actions";
import { getProducts } from "@/actions/product.actions";
import MetricCard from "@/components/dashboard/MetricCard";
import StockTable from "@/components/dashboard/StockTable";
import { Package, AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";

export const revalidate = 0;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const search = params.q;

  const [stats, products] = await Promise.all([
    getDashboardStats(),
    getProducts(search),
  ]);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">ภาพรวมสต็อก</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {new Date().toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="สินค้าทั้งหมด"
          value={stats.totalProducts}
          icon={<Package size={20} />}
          color="blue"
        />
        <MetricCard
          label="สต็อกใกล้หมด"
          value={stats.lowStockProducts}
          icon={<AlertTriangle size={20} />}
          color="red"
        />
        <MetricCard
          label="นำเข้าวันนี้"
          value={`+${stats.todayIn}`}
          icon={<TrendingUp size={20} />}
          color="green"
        />
        <MetricCard
          label="เบิกออกวันนี้"
          value={`-${stats.todayOut}`}
          icon={<TrendingDown size={20} />}
          color="amber"
        />
      </div>

      {/* Stock Table */}
      <StockTable products={products} search={search} />
    </div>
  );
}
