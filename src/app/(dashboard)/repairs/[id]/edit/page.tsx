import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDepartments } from "@/actions/department.actions";
import { getTechnicians } from "@/actions/technician.actions";
import { getDeviceTypes } from "@/actions/deviceType.actions";
import { getRepairJobById } from "@/actions/repair.actions";
import RepairForm from "@/components/repairs/RepairForm";

export const revalidate = 0;

export default async function EditRepairPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, departments, technicians, deviceTypes, t] = await Promise.all([
    getRepairJobById(Number(id)),
    getDepartments(),
    getTechnicians(),
    getDeviceTypes(),
    getTranslations("RepairForm"),
  ]);

  if (!job) notFound();

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-xl font-bold text-slate-900">{t("editTitle")}</h1>
      <div className="card p-6">
        <RepairForm departments={departments} technicians={technicians} deviceTypes={deviceTypes} job={job} />
      </div>
    </div>
  );
}
