import { getCategories, getProductById } from "@/actions/product.actions";
import ProductForm from "@/components/products/ProductForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);
  if (!productId) notFound();

  const [product, categories] = await Promise.all([
    getProductById(productId),
    getCategories(),
  ]);

  if (!product) notFound();

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/products" className="btn-ghost p-2">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">แก้ไขสินค้า</h1>
          <p className="text-sm text-slate-500">{product.name}</p>
        </div>
      </div>

      <div className="card p-6">
        <ProductForm categories={categories} product={product} />
      </div>
    </div>
  );
}
