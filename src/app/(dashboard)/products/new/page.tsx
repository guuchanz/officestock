import { getCategories } from "@/actions/product.actions";
import ProductForm from "@/components/products/ProductForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function NewProductPage() {
  const [categories, t] = await Promise.all([getCategories(), getTranslations("Products")]);

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/products" className="btn-ghost p-2">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t("addNew")}</h1>
          <p className="text-sm text-slate-500">{t("addNewSubtitle")}</p>
        </div>
      </div>

      <div className="card p-6">
        <ProductForm categories={categories} />
      </div>
    </div>
  );
}
