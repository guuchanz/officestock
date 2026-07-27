import { getDeviceTypes } from "@/actions/deviceType.actions";
import DeviceTypeForm from "@/components/deviceTypes/DeviceTypeForm";
import DeviceTypeRow from "@/components/deviceTypes/DeviceTypeRow";
import { getTranslations } from "next-intl/server";

export const revalidate = 0;

export default async function DeviceTypesPage() {
  const [deviceTypes, t] = await Promise.all([
    getDeviceTypes(),
    getTranslations("DeviceTypes"),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{t("itemsCount", { count: deviceTypes.length })}</p>
      </div>

      <div className="card overflow-hidden">
        <DeviceTypeForm />
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
              {deviceTypes.length === 0 && (
                <tr><td colSpan={3} className="py-12 text-center text-slate-400 text-sm">{t("empty")}</td></tr>
              )}
              {deviceTypes.map((dt) => (
                <DeviceTypeRow key={dt.id} deviceType={dt} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
