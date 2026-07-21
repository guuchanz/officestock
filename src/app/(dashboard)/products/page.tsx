import { getProducts } from "@/actions/product.actions";
import StockTable from "@/components/dashboard/StockTable";
import Link from "next/link";
import { PlusCircle } from "lucide-react";

export const revalidate = 0;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const products = await getProducts(params.q);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">สินค้าคงคลัง</h1>
          <p className="text-sm text-slate-500 mt-0.5">{products.length} รายการ</p>
        </div>
        <Link href="/products/new" className="btn-primary">
          <PlusCircle size={16} />
          เพิ่มสินค้าใหม่
        </Link>
      </div>
      <StockTable products={products} search={params.q} />
    </div>
  );
}
