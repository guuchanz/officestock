import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getRepairJobs } from "@/actions/repair.actions";
import RepairFilters from "@/components/repairs/RepairFilters";
import RepairRow from "@/components/repairs/RepairRow";

export const revalidate = 0;

export default async function RepairsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const [jobs, t] = await Promise.all([
    getRepairJobs(params),
    getTranslations("Repairs"),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t("itemsCount", { count: jobs.length })}</p>
        </div>
        <Link href="/repairs/new" className="btn-primary">
          <PlusCircle size={16} />
          {t("addNew")}
        </Link>
      </div>

      <div className="card overflow-hidden">
        <RepairFilters />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">{t("colJobNumber")}</th>
                <th className="px-4 py-3 font-medium">{t("colDevice")}</th>
                <th className="px-4 py-3 font-medium">{t("colOwner")}</th>
                <th className="px-4 py-3 font-medium">{t("colTechnician")}</th>
                <th className="px-4 py-3 font-medium">{t("colReportedAt")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("colTotalCost")}</th>
                <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400 text-sm">{t("empty")}</td></tr>
              )}
              {jobs.map((job) => <RepairRow key={job.id} job={job} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
