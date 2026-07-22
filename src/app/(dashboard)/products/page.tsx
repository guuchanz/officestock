import { getProducts } from "@/actions/product.actions";
import { getDepartments } from "@/actions/department.actions";
import StockTable from "@/components/dashboard/StockTable";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

export const revalidate = 0;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const [products, departments, t] = await Promise.all([
    getProducts(params.q),
    getDepartments(),
    getTranslations("Products"),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t("itemsCount", { count: products.length })}</p>
        </div>
        <Link href="/products/new" className="btn-primary">
          <PlusCircle size={16} />
          {t("addNew")}
        </Link>
      </div>
      <StockTable products={products} departments={departments} search={params.q} />
    </div>
  );
}
