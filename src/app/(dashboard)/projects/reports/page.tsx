import Link from "next/link";
import { Download } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getProjectReport } from "@/actions/projectReport.actions";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";

export const revalidate = 0;

const money = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function ProjectReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; status?: string }>;
}) {
  const params = await searchParams;
  const year = Number(params.year) || new Date().getFullYear();

  const [{ rows }, t] = await Promise.all([
    getProjectReport(year, params.status),
    getTranslations("ProjectReports"),
  ]);

  const totals = rows.reduce(
    (a, r) => ({ budget: a.budget + r.budget, actual: a.actual + r.actualCost }),
    { budget: 0, actual: 0 }
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">{t("title", { year })}</h1>
        <Link
          href={`/api/projects/reports?year=${year}${params.status ? `&status=${params.status}` : ""}&format=excel`}
          className="btn-primary"
        >
          <Download size={16} />{t("exportExcel")}
        </Link>
      </div>

      <div className="card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">{t("colCode")}</th>
              <th className="px-4 py-3 font-medium">{t("colName")}</th>
              <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
              <th className="px-4 py-3 font-medium">{t("colDue")}</th>
              <th className="px-4 py-3 font-medium">{t("colFinished")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("colDaysLate")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("colBudget")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("colActual")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("colVariance")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="border-t border-slate-100">
                <td className="px-5 py-3 whitespace-nowrap">{r.code}</td>
                <td className="px-4 py-3">{r.name}</td>
                <td className="px-4 py-3"><ProjectStatusBadge status={r.status} /></td>
                <td className="px-4 py-3 whitespace-nowrap">{r.dueDate?.toLocaleDateString("th-TH") ?? "-"}</td>
                <td className="px-4 py-3 whitespace-nowrap">{r.finishedAt?.toLocaleDateString("th-TH") ?? "-"}</td>
                <td className={`px-4 py-3 text-right tabular-nums ${r.daysLate && r.daysLate > 0 ? "text-red-600" : ""}`}>
                  {r.daysLate ?? "-"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{money(r.budget)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(r.actualCost)}</td>
                <td className={`px-4 py-3 text-right tabular-nums ${r.variance < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {money(r.variance)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-5 py-10 text-center text-slate-400">{t("empty")}</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-semibold">
                <td className="px-5 py-3" colSpan={6}>{t("total")}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(totals.budget)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(totals.actual)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(totals.budget - totals.actual)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
