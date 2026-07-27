import { FileSpreadsheet, FileText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getMaintenanceHistory, getMaintenanceDue } from "@/actions/maintenanceReport.actions";
import DueBadge from "@/components/maintenance/DueBadge";

export const revalidate = 0;

export default async function MaintenanceReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; kind?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month =
    params.month === "" ? undefined : Number(params.month) || now.getMonth() + 1;
  const kind = params.kind === "due" ? "due" : "history";

  const [history, due, t] = await Promise.all([
    getMaintenanceHistory(year, month),
    kind === "due" ? getMaintenanceDue() : Promise.resolve([]),
    getTranslations("MaintenanceReports"),
  ]);

  const label = month ? `${year}-${String(month).padStart(2, "0")}` : String(year);
  const query =
    kind === "due" ? "kind=due" : `kind=history&year=${year}${month ? `&month=${month}` : ""}`;
  const money = (n: number) =>
    n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const cards =
    kind === "due"
      ? [
          { label: t("totalEquipment"), value: String(due.length) },
          { label: t("overdue"),  value: String(due.filter((d) => d.bucket === "OVERDUE").length) },
          { label: t("dueSoon"),  value: String(due.filter((d) => d.bucket === "DUE_SOON").length) },
          { label: t("scheduled"), value: String(due.filter((d) => d.bucket === "SCHEDULED").length) },
        ]
      : [
          { label: t("totalServices"), value: String(history.totalJobs) },
          { label: t("totalCost"),     value: money(history.totalCost) },
          { label: t("resultOK"),      value: String(history.byResult.OK) },
          { label: t("resultNeedsRepair"), value: String(history.byResult.NEEDS_REPAIR) },
        ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {kind === "due" ? t("dueSubtitle") : label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/maintenance/reports?${query}&format=excel`}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50 transition-all"
            title={t("downloadExcel")}
          >
            <FileSpreadsheet size={14} />
            Excel
          </a>
          <a
            href={`/api/maintenance/reports?${query}&format=pdf`}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition-all"
            title={t("downloadPdf")}
          >
            <FileText size={14} />
            PDF
          </a>
        </div>
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label" htmlFor="kind">{t("kindLabel")}</label>
          <select id="kind" name="kind" className="input" defaultValue={kind}>
            <option value="history">{t("kindHistory")}</option>
            <option value="due">{t("kindDue")}</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="year">{t("yearLabel")}</label>
          <select id="year" name="year" className="input" defaultValue={year}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="month">{t("monthLabel")}</label>
          <select id="month" name="month" className="input" defaultValue={month ?? ""}>
            <option value="">{t("wholeYear")}</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary py-2.5">{t("apply")}</button>
      </form>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <p className="text-xs uppercase tracking-wide text-slate-400">{c.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          {kind === "due" ? (
            <>
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3 font-medium">{t("colAssetNo")}</th>
                  <th className="px-4 py-3 font-medium">{t("colEquipment")}</th>
                  <th className="px-4 py-3 font-medium">{t("colFactory")}</th>
                  <th className="px-4 py-3 font-medium">{t("colArea")}</th>
                  <th className="px-4 py-3 font-medium">{t("colIncharge")}</th>
                  <th className="px-4 py-3 font-medium">{t("colNextDue")}</th>
                  <th className="px-5 py-3 font-medium text-right">{t("colStatus")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {due.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-slate-400 text-sm">{t("empty")}</td></tr>
                )}
                {due.map((r) => (
                  <tr key={r.assetNo} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-xs text-slate-700">{r.assetNo}</td>
                    <td className="px-4 py-3 text-slate-800">
                      {r.equipment}
                      {r.model !== "-" && <span className="block text-xs text-slate-400">{r.model}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.factory}</td>
                    <td className="px-4 py-3 text-slate-600">{r.area}</td>
                    <td className="px-4 py-3 text-slate-600">{r.incharge}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.nextDueAt.toLocaleDateString("th-TH")}</td>
                    <td className="px-5 py-3 text-right"><DueBadge bucket={r.bucket} remaining={r.remaining} /></td>
                  </tr>
                ))}
              </tbody>
            </>
          ) : (
            <>
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3 font-medium">{t("colDate")}</th>
                  <th className="px-4 py-3 font-medium">{t("colAssetNo")}</th>
                  <th className="px-4 py-3 font-medium">{t("colEquipment")}</th>
                  <th className="px-4 py-3 font-medium">{t("colFactory")}</th>
                  <th className="px-4 py-3 font-medium">{t("colTechnician")}</th>
                  <th className="px-4 py-3 font-medium">{t("colResult")}</th>
                  <th className="px-5 py-3 font-medium text-right">{t("colCost")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.rows.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-slate-400 text-sm">{t("empty")}</td></tr>
                )}
                {history.rows.map((r, i) => (
                  <tr key={`${r.assetNo}-${i}`} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{r.performedAt.toLocaleDateString("th-TH")}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.assetNo}</td>
                    <td className="px-4 py-3 text-slate-800">{r.equipment}</td>
                    <td className="px-4 py-3 text-slate-600">{r.factory}</td>
                    <td className="px-4 py-3 text-slate-600">{r.technician}</td>
                    <td className="px-4 py-3 text-slate-600">{t(`result${r.result}`)}</td>
                    <td className="px-5 py-3 text-right text-slate-700">{money(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
      </div>
    </div>
  );
}
