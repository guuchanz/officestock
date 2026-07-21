import { getCategories } from "@/actions/product.actions";
import ProductForm from "@/components/products/ProductForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function NewProductPage() {
  const categories = await getCategories();

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/products" className="btn-ghost p-2">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">เพิ่มสินค้าใหม่</h1>
          <p className="text-sm text-slate-500">กรอกข้อมูลสินค้าที่ต้องการเพิ่มเข้าระบบ</p>
        </div>
      </div>

      <div className="card p-6">
        <ProductForm categories={categories} />
      </div>
    </div>
  );
}
