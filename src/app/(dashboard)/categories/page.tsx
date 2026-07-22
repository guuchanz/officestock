import { getCategoriesWithCount } from "@/actions/category.actions";
import CategoryForm from "@/components/categories/CategoryForm";
import CategoryRow from "@/components/categories/CategoryRow";
import { getTranslations } from "next-intl/server";

export const revalidate = 0;

export default async function CategoriesPage() {
  const [categories, t] = await Promise.all([
    getCategoriesWithCount(),
    getTranslations("Categories"),
  ]);

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{t("subtitle")}</p>
      </div>

      <div className="card p-6">
        <CategoryForm />
      </div>

      <div className="card divide-y divide-slate-100">
        {categories.length === 0 ? (
          <p className="p-6 text-sm text-slate-500 text-center">{t("empty")}</p>
        ) : (
          categories.map((c) => <CategoryRow key={c.id} category={c} />)
        )}
      </div>
    </div>
  );
}
