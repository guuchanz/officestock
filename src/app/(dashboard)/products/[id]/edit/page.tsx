import { getCategories, getProductById } from "@/actions/product.actions";
import ProductForm from "@/components/products/ProductForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);
  if (!productId) notFound();

  const [product, categories, t] = await Promise.all([
    getProductById(productId),
    getCategories(),
    getTranslations("Products"),
  ]);

  if (!product) notFound();

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/products" className="btn-ghost p-2">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t("editTitle")}</h1>
          <p className="text-sm text-slate-500">{product.name}</p>
        </div>
      </div>

      <div className="card p-6">
        <ProductForm categories={categories} product={product} />
      </div>
    </div>
  );
}
