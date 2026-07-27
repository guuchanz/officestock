import { getAreas } from "@/actions/area.actions";
import AreaForm from "@/components/areas/AreaForm";
import AreaRow from "@/components/areas/AreaRow";
import { getTranslations } from "next-intl/server";

export const revalidate = 0;

export default async function AreasPage() {
  const [rows, t] = await Promise.all([
    getAreas(),
    getTranslations("Areas"),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{t("itemsCount", { count: rows.length })}</p>
      </div>

      <div className="card overflow-hidden">
        <AreaForm />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">{t("colName")}</th>
                <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr><td colSpan={3} className="py-12 text-center text-slate-400 text-sm">{t("empty")}</td></tr>
              )}
              {rows.map((row) => (
                <AreaRow key={row.id} area={row} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
