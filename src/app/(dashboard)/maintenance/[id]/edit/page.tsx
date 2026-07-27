import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getEquipmentById } from "@/actions/equipment.actions";
import { getFactories } from "@/actions/factory.actions";
import { getAreas } from "@/actions/area.actions";
import { getTechnicians } from "@/actions/technician.actions";
import EquipmentForm from "@/components/maintenance/EquipmentForm";
import EquipmentDocuments from "@/components/maintenance/EquipmentDocuments";

export const revalidate = 0;

export default async function EditEquipmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const equipmentId = Number(id);
  if (!Number.isInteger(equipmentId)) notFound();

  const [equipment, factories, areas, technicians, t] = await Promise.all([
    getEquipmentById(equipmentId),
    getFactories(false),
    getAreas(false),
    getTechnicians(false),
    getTranslations("EquipmentForm"),
  ]);
  if (!equipment) notFound();

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <p className="font-mono text-xs text-slate-500">{equipment.assetNo}</p>
        <h1 className="text-xl font-bold text-slate-900">{t("editTitle")}</h1>
      </div>

      <EquipmentForm
        factories={factories}
        areas={areas}
        technicians={technicians}
        equipment={{
          id:             equipment.id,
          assetNo:        equipment.assetNo,
          name:           equipment.name,
          model:          equipment.model,
          serialNo:       equipment.serialNo,
          detail:         equipment.detail,
          factoryId:      equipment.factoryId,
          areaId:         equipment.areaId,
          technicianId:   equipment.technicianId,
          intervalMonths: equipment.intervalMonths,
          baselineAt:     equipment.baselineAt,
          isActive:       equipment.isActive,
          note:           equipment.note,
        }}
      />

      {/*
        Documents are their own server actions, not part of the equipment form
        submit — uploading here saves immediately and does not require pressing
        Save on the form above.
      */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">
            {t("documentsTitle", { count: equipment.documents.length })}
          </h2>
        </div>
        <EquipmentDocuments equipmentId={equipment.id} documents={equipment.documents} />
      </div>
    </div>
  );
}
