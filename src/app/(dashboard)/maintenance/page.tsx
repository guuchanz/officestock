import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getEquipmentList } from "@/actions/equipment.actions";
import { getFactories } from "@/actions/factory.actions";
import { getAreas } from "@/actions/area.actions";
import EquipmentFilters from "@/components/maintenance/EquipmentFilters";
import EquipmentRow from "@/components/maintenance/EquipmentRow";

export const revalidate = 0;

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; bucket?: string; factoryId?: string; areaId?: string }>;
}) {
  const params = await searchParams;
  const [items, factories, areas, t] = await Promise.all([
    getEquipmentList(params),
    getFactories(false),
    getAreas(false),
    getTranslations("Maintenance"),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t("itemsCount", { count: items.length })}</p>
        </div>
        <Link href="/maintenance/new" className="btn-primary">
          <PlusCircle size={16} />
          {t("addNew")}
        </Link>
      </div>

      <div className="card overflow-hidden">
        <EquipmentFilters factories={factories} areas={areas} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">{t("colAssetNo")}</th>
                <th className="px-4 py-3 font-medium">{t("colEquipment")}</th>
                <th className="px-4 py-3 font-medium">{t("colLocation")}</th>
                <th className="px-4 py-3 font-medium">{t("colIncharge")}</th>
                <th className="px-4 py-3 font-medium text-center">{t("colInterval")}</th>
                <th className="px-4 py-3 font-medium">{t("colLastDone")}</th>
                <th className="px-4 py-3 font-medium">{t("colDue")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400 text-sm">{t("empty")}</td></tr>
              )}
              {items.map((item) => (
                <EquipmentRow key={item.id} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
