import { FileSpreadsheet, FileText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getRepairReport } from "@/actions/repairReport.actions";
import RepairStatusBadge from "@/components/repairs/RepairStatusBadge";

export const revalidate = 0;

export default async function RepairReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month =
    params.month === "" ? undefined : Number(params.month) || now.getMonth() + 1;

  const [report, t] = await Promise.all([
    getRepairReport(year, month),
    getTranslations("RepairReports"),
  ]);

  const label = month ? `${year}-${String(month).padStart(2, "0")}` : String(year);
  const query = `year=${year}${month ? `&month=${month}` : ""}`;
  const money = (n: number) =>
    n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const cards = [
    { label: t("totalJobs"), value: String(report.totalJobs) },
    { label: t("totalCost"), value: money(report.totalCost) },
    { label: t("internal"),  value: String(report.internalJobs), sub: money(report.internalCost) },
    { label: t("external"),  value: String(report.externalJobs), sub: money(report.externalCost) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{label}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/repairs/reports?${query}&format=excel`}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50 transition-all"
            title={t("downloadExcel")}
          >
            <FileSpreadsheet size={14} />
            Excel
          </a>
          <a
            href={`/api/repairs/reports?${query}&format=pdf`}
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
            {c.sub && <p className="text-xs text-slate-400">{c.sub}</p>}
          </div>
        ))}
      </div>

      <div className="card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">{t("colJobNumber")}</th>
              <th className="px-4 py-3 font-medium">{t("colReportedAt")}</th>
              <th className="px-4 py-3 font-medium">{t("colDeviceType")}</th>
              <th className="px-4 py-3 font-medium">{t("colDevice")}</th>
              <th className="px-4 py-3 font-medium">{t("colTechnician")}</th>
              <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
              <th className="px-5 py-3 font-medium text-right">{t("colTotalCost")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {report.rows.length === 0 && (
              <tr><td colSpan={7} className="py-12 text-center text-slate-400 text-sm">{t("empty")}</td></tr>
            )}
            {report.rows.map((r) => (
              <tr key={r.jobNumber} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-mono text-xs text-slate-700">{r.jobNumber}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.reportedAt.toLocaleDateString("th-TH")}</td>
                <td className="px-4 py-3">
                  {r.deviceType === "-" ? (
                    <span className="text-slate-300">-</span>
                  ) : (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {r.deviceType}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-800">
                  {r.deviceName}
                  {r.deviceModel !== "-" && <span className="block text-xs text-slate-400">{r.deviceModel}</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">{r.technician}</td>
                <td className="px-4 py-3"><RepairStatusBadge status={r.status} /></td>
                <td className="px-5 py-3 text-right text-slate-700">{money(r.totalCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
