"use client";

import { useMemo, useState } from "react";
import { Building2, TrendingDown } from "lucide-react";
import LineChart from "./LineChart";
import { CATEGORICAL_PALETTE } from "@/lib/chart-colors";
import type { MonthChartData } from "@/actions/report.actions";

interface MonthlyChartsSectionProps {
  data:           MonthChartData[];
  allDepartments: { id: number; name: string }[];
}

export default function MonthlyChartsSection({ data, allDepartments }: MonthlyChartsSectionProps) {
  const [month, setMonth] = useState(data[0]?.month ?? "");

  const current = useMemo(() => data.find((d) => d.month === month) ?? null, [data, month]);

  const departmentColor = useMemo(() => {
    const sorted = [...allDepartments].sort((a, b) => a.name.localeCompare(b.name));
    const map = new Map<string, string>();
    sorted.forEach((d, i) => map.set(d.name, CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]));
    return map;
  }, [allDepartments]);

  const departmentSeries = useMemo(
    () =>
      (current?.departmentSeries ?? []).map((s) => ({
        ...s,
        color: departmentColor.get(s.label) ?? CATEGORICAL_PALETTE[0],
      })),
    [current, departmentColor]
  );

  const productSeries = useMemo(
    () =>
      (current?.topProductSeries ?? []).map((s, i) => ({
        ...s,
        color: CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length],
      })),
    [current]
  );

  const xLabels = useMemo(
    () => (current ? Array.from({ length: current.daysInMonth }, (_, i) => String(i + 1)) : []),
    [current]
  );

  if (data.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-slate-400">ยังไม่มีข้อมูลรายการสำหรับแสดงกราฟ</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="font-semibold text-slate-800">แนวโน้มรายวัน</h2>
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="input w-full sm:w-48">
          {data.map((d) => (
            <option key={d.month} value={d.month}>{d.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4 sm:p-6 transition-shadow hover:shadow-md min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
                <Building2 size={17} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">รายการตามแผนกต่อวัน</h3>
                <p className="text-xs text-slate-400">แยกตามแผนกที่ระบุ</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-slate-800 tabular-nums leading-tight">
                {(current?.totalDepartmentTx ?? 0).toLocaleString("th-TH")}
              </p>
              <p className="text-[11px] text-slate-400">รายการ</p>
            </div>
          </div>
          <div className="mt-4">
            <LineChart series={departmentSeries} xLabels={xLabels} emptyMessage="ยังไม่มีรายการที่ระบุแผนกในเดือนนี้" />
          </div>
        </div>

        <div className="card p-4 sm:p-6 transition-shadow hover:shadow-md min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shrink-0">
                <TrendingDown size={17} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">สินค้าเบิกออกมากที่สุด</h3>
                <p className="text-xs text-slate-400">5 อันดับสินค้า</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-slate-800 tabular-nums leading-tight">
                {(current?.totalOutQty ?? 0).toLocaleString("th-TH")}
              </p>
              <p className="text-[11px] text-slate-400">ชิ้น</p>
            </div>
          </div>
          <div className="mt-4">
            <LineChart series={productSeries} xLabels={xLabels} emptyMessage="ยังไม่มีรายการเบิกออกในเดือนนี้" />
          </div>
        </div>
      </div>
    </div>
  );
}
