import { getMonthlyCostReport, getChartData } from "@/actions/report.actions";
import { getDepartments } from "@/actions/department.actions";
import { ArrowDownCircle, ArrowUpCircle, Wallet, FileSpreadsheet, FileText } from "lucide-react";
import MetricCard from "@/components/dashboard/MetricCard";
import MonthlyChartsSection from "@/components/reports/MonthlyChartsSection";

export const revalidate = 0;

function currency(n: number) {
  return `฿${n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function ReportsPage() {
  const [months, chartData, departments] = await Promise.all([
    getMonthlyCostReport(),
    getChartData(),
    getDepartments(),
  ]);

  const totalIn    = months.reduce((s, m) => s + m.inCost, 0);
  const totalOut   = months.reduce((s, m) => s + m.outCost, 0);
  const totalCost  = totalIn + totalOut;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">รายงานต้นทุน</h1>
        <p className="text-sm text-slate-500 mt-0.5">สรุปมูลค่าการนำเข้า-เบิกออกสินค้ารายเดือน</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="มูลค่านำเข้ารวม"
          value={currency(totalIn)}
          icon={<ArrowDownCircle size={20} />}
          color="emerald"
        />
        <MetricCard
          label="มูลค่าเบิกออกรวม"
          value={currency(totalOut)}
          icon={<ArrowUpCircle size={20} />}
          color="rose"
        />
        <MetricCard
          label="มูลค่ารวมทั้งหมด"
          value={currency(totalCost)}
          icon={<Wallet size={20} />}
          color="indigo"
        />
      </div>

      <MonthlyChartsSection data={chartData} allDepartments={departments} />

      {/* Monthly table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">สรุปรายเดือน</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">เดือน</th>
                <th className="px-4 py-3 font-medium text-center">จำนวนนำเข้า</th>
                <th className="px-4 py-3 font-medium text-right">มูลค่านำเข้า</th>
                <th className="px-4 py-3 font-medium text-center">จำนวนเบิกออก</th>
                <th className="px-4 py-3 font-medium text-right">มูลค่าเบิกออก</th>
                <th className="px-5 py-3 font-medium text-right">มูลค่ารวม</th>
                <th className="px-5 py-3 font-medium text-center">ดาวน์โหลด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {months.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    ยังไม่มีข้อมูลรายการ
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
                        title="ดาวน์โหลด Excel"
                      >
                        <FileSpreadsheet size={14} />
                        Excel
                      </a>
                      <a
                        href={`/api/reports/${m.month}?format=pdf`}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition-all"
                        title="ดาวน์โหลด PDF"
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
