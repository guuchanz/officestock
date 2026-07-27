import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Wrench } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getEquipmentById } from "@/actions/equipment.actions";
import { getTechnicians } from "@/actions/technician.actions";
import DueBadge from "@/components/maintenance/DueBadge";
import ServiceLogForm from "@/components/maintenance/ServiceLogForm";
import ServiceLogTable from "@/components/maintenance/ServiceLogTable";
import EquipmentDocumentList from "@/components/maintenance/EquipmentDocumentList";

export const revalidate = 0;

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const equipmentId = Number(id);
  if (!Number.isInteger(equipmentId)) notFound();

  const [equipment, technicians, t] = await Promise.all([
    getEquipmentById(equipmentId),
    getTechnicians(false),
    getTranslations("EquipmentDetail"),
  ]);
  if (!equipment) notFound();

  const needsRepair = equipment.logs[0]?.result === "NEEDS_REPAIR";

  const facts: { label: string; value: string }[] = [
    { label: t("model"),     value: equipment.model ?? "-" },
    { label: t("serialNo"),  value: equipment.serialNo ?? "-" },
    { label: t("factory"),   value: equipment.factory?.name ?? "-" },
    { label: t("area"),      value: equipment.area?.name ?? "-" },
    { label: t("incharge"),  value: equipment.technician?.name ?? "-" },
    { label: t("interval"),  value: t("everyMonths", { months: equipment.intervalMonths }) },
    { label: t("baseline"),  value: equipment.baselineAt.toLocaleDateString("th-TH") },
    { label: t("lastDone"),  value: equipment.lastDoneAt?.toLocaleDateString("th-TH") ?? "-" },
    { label: t("nextDue"),   value: equipment.nextDueAt.toLocaleDateString("th-TH") },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-slate-500">{equipment.assetNo}</p>
          <h1 className="text-xl font-bold text-slate-900">{equipment.name}</h1>
          <div className="mt-1.5">
            <DueBadge bucket={equipment.bucket} remaining={equipment.remaining} />
          </div>
        </div>
        <Link href={`/maintenance/${equipment.id}/edit`} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
          <Pencil size={15} />{t("edit")}
        </Link>
      </div>

      {needsRepair && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-l-4 border-amber-400 p-4">
          <p className="text-sm text-amber-800">{t("needsRepairNotice")}</p>
          <Link href="/repairs/new" className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600">
            <Wrench size={15} />{t("openRepairJob")}
          </Link>
        </div>
      )}

      <div className="card p-5">
        <dl className="grid gap-4 sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="text-xs uppercase tracking-wide text-slate-400">{f.label}</dt>
              <dd className="mt-0.5 text-sm text-slate-800">{f.value}</dd>
            </div>
          ))}
        </dl>
        {equipment.detail && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">{t("detail")}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{equipment.detail}</p>
          </div>
        )}
        {equipment.note && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">{t("note")}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{equipment.note}</p>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">
            {t("documentsTitle", { count: equipment.documents.length })}
          </h2>
          <Link
            href={`/maintenance/${equipment.id}/edit`}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            {t("manageDocuments")}
          </Link>
        </div>
        <EquipmentDocumentList documents={equipment.documents} />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">{t("recordTitle")}</h2>
        </div>
        <ServiceLogForm
          equipmentId={equipment.id}
          technicians={technicians}
          defaultTechnicianId={equipment.technicianId}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">
            {t("historyTitle", { count: equipment.logs.length })}
          </h2>
        </div>
        <ServiceLogTable logs={equipment.logs} />
      </div>
    </div>
  );
}
