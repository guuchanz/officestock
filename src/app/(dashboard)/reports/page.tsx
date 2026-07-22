import { getMonthlyCostReport, getYearlyCostReport, getChartData } from "@/actions/report.actions";
import { getDepartments } from "@/actions/department.actions";
import { FileSpreadsheet, FileText } from "lucide-react";
import ReportsOverview from "@/components/reports/ReportsOverview";
import { getTranslations } from "next-intl/server";

export const revalidate = 0;

function currency(n: number) {
  return `฿${n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function ReportsPage() {
  const [months, years, chartData, departments, t] = await Promise.all([
    getMonthlyCostReport(),
    getYearlyCostReport(),
    getChartData(),
    getDepartments(),
    getTranslations("Reports"),
  ]);

  return (
    <div className="space-y-5">
      <ReportsOverview months={months} chartData={chartData} allDepartments={departments} />

      {/* Monthly table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">{t("monthlyTableTitle")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">{t("colMonth")}</th>
                <th className="px-4 py-3 font-medium text-center">{t("colImportQty")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("colImportValue")}</th>
                <th className="px-4 py-3 font-medium text-center">{t("colWithdrawQty")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("colWithdrawValue")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("colTotalValue")}</th>
                <th className="px-5 py-3 font-medium text-center">{t("colDownload")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {months.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    {t("emptyData")}
                  </td>
                </tr>
              )}
              {months.map((m) => (
                <tr key={m.month} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-800">{m.label}</td>
                  <td className="px-4 py-3.5 text-center text-green-600 font-semibold tabular-nums">
                    +{m.inQty}
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-600 tabular-nums">{currency(m.inCost)}</td>
                  <td className="px-4 py-3.5 text-center text-red-600 font-semibold tabular-nums">
                    -{m.outQty}
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-600 tabular-nums">{currency(m.outCost)}</td>
                  <td className="px-5 py-3.5 text-right font-bold text-slate-800 tabular-nums">
                    {currency(m.totalCost)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-center gap-2">
                      <a
                        href={`/api/reports/${m.month}?format=excel`}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50 transition-all"
                        title={t("downloadExcel")}
                      >
                        <FileSpreadsheet size={14} />
                        Excel
                      </a>
                      <a
                        href={`/api/reports/${m.month}?format=pdf`}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition-all"
                        title={t("downloadPdf")}
                      >
                        <FileText size={14} />
                        PDF
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Yearly table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">{t("yearlyTableTitle")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">{t("colYear")}</th>
                <th className="px-4 py-3 font-medium text-center">{t("colImportQty")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("colImportValue")}</th>
                <th className="px-4 py-3 font-medium text-center">{t("colWithdrawQty")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("colWithdrawValue")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("colTotalValue")}</th>
                <th className="px-5 py-3 font-medium text-center">{t("colDownload")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {years.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    {t("emptyData")}
                  </td>
                </tr>
              )}
              {years.map((y) => (
                <tr key={y.year} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-800">{y.label}</td>
                  <td className="px-4 py-3.5 text-center text-green-600 font-semibold tabular-nums">
                    +{y.inQty}
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-600 tabular-nums">{currency(y.inCost)}</td>
                  <td className="px-4 py-3.5 text-center text-red-600 font-semibold tabular-nums">
                    -{y.outQty}
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-600 tabular-nums">{currency(y.outCost)}</td>
                  <td className="px-5 py-3.5 text-right font-bold text-slate-800 tabular-nums">
                    {currency(y.totalCost)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-center gap-2">
                      <a
                        href={`/api/reports/year/${y.year}?format=excel`}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50 transition-all"
                        title={t("downloadExcel")}
                      >
                        <FileSpreadsheet size={14} />
                        Excel
                      </a>
                      <a
                        href={`/api/reports/year/${y.year}?format=pdf`}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition-all"
                        title={t("downloadPdf")}
                      >
                        <FileText size={14} />
                        PDF
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
