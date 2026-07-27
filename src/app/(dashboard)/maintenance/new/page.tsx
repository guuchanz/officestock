import { getTranslations } from "next-intl/server";
import { getFactories } from "@/actions/factory.actions";
import { getAreas } from "@/actions/area.actions";
import { getTechnicians } from "@/actions/technician.actions";
import EquipmentForm from "@/components/maintenance/EquipmentForm";

export const revalidate = 0;

export default async function NewEquipmentPage() {
  const [factories, areas, technicians, t] = await Promise.all([
    getFactories(false),
    getAreas(false),
    getTechnicians(false),
    getTranslations("EquipmentForm"),
  ]);

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-xl font-bold text-slate-900">{t("newTitle")}</h1>
      <EquipmentForm factories={factories} areas={areas} technicians={technicians} />
    </div>
  );
}
