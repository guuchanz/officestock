import { getTranslations } from "next-intl/server";
import { getDepartments } from "@/actions/department.actions";
import { getTechnicians } from "@/actions/technician.actions";
import { getDeviceTypes } from "@/actions/deviceType.actions";
import RepairForm from "@/components/repairs/RepairForm";

export const revalidate = 0;

export default async function NewRepairPage() {
  const [departments, technicians, deviceTypes, t] = await Promise.all([
    getDepartments(),
    getTechnicians(false),
    getDeviceTypes(false),
    getTranslations("RepairForm"),
  ]);

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-xl font-bold text-slate-900">{t("newTitle")}</h1>
      <div className="card p-6">
        <RepairForm departments={departments} technicians={technicians} deviceTypes={deviceTypes} />
      </div>
    </div>
  );
}
