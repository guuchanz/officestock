"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";
import MetricCard from "@/components/dashboard/MetricCard";
import MonthlyChartsSection from "./MonthlyChartsSection";
import type { MonthlyCostSummary, MonthChartData } from "@/actions/report.actions";

interface ReportsOverviewProps {
  months:         MonthlyCostSummary[];
  chartData:      MonthChartData[];
  allDepartments: { id: number; name: string }[];
}

function currency(n: number) {
  return `฿${n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ReportsOverview({ months, chartData, allDepartments }: ReportsOverviewProps) {
  const t = useTranslations("Reports");
  const [month, setMonth] = useState(months[0]?.month ?? "");

  const current = useMemo(() => months.find((m) => m.month === month) ?? null, [months, month]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {current ? t("subtitleForMonth", { month: current.label }) : t("subtitleDefault")}
          </p>
        </div>
        {months.length > 0 && (
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="input w-full sm:w-52">
            {months.map((m) => (
              <option key={m.month} value={m.month}>{m.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* Summary cards — scoped to the selected month */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label={t("cardImport")}
          value={currency(current?.inCost ?? 0)}
          icon={<ArrowDownCircle size={20} />}
          color="emerald"
        />
        <MetricCard
          label={t("cardWithdraw")}
          value={currency(current?.outCost ?? 0)}
          icon={<ArrowUpCircle size={20} />}
          color="rose"
        />
        <MetricCard
          label={t("cardTotal")}
          value={currency(current?.totalCost ?? 0)}
          icon={<Wallet size={20} />}
          color="indigo"
        />
      </div>

      <MonthlyChartsSection data={chartData} allDepartments={allDepartments} month={month} />
    </div>
  );
}
