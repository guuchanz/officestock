import { getDepartmentsWithCount } from "@/actions/department.actions";
import DepartmentForm from "@/components/departments/DepartmentForm";
import DepartmentRow from "@/components/departments/DepartmentRow";
import { getTranslations } from "next-intl/server";

export const revalidate = 0;

export default async function DepartmentsPage() {
  const [departments, t] = await Promise.all([
    getDepartmentsWithCount(),
    getTranslations("Departments"),
  ]);

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{t("subtitle")}</p>
      </div>

      <div className="card p-6">
        <DepartmentForm />
      </div>

      <div className="card divide-y divide-slate-100">
        {departments.length === 0 ? (
          <p className="p-6 text-sm text-slate-500 text-center">{t("empty")}</p>
        ) : (
          departments.map((d) => <DepartmentRow key={d.id} department={d} />)
        )}
      </div>
    </div>
  );
}
