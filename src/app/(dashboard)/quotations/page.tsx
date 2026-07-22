import { getQuotations } from "@/actions/quotation.actions";
import QuotationRow from "@/components/quotations/QuotationRow";
import QuotationFilters from "@/components/quotations/QuotationFilters";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

export const revalidate = 0;

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const [quotations, t] = await Promise.all([
    getQuotations(params),
    getTranslations("Quotations"),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t("itemsCount", { count: quotations.length })}</p>
        </div>
        <Link href="/quotations/new" className="btn-primary">
          <PlusCircle size={16} />
          {t("addNew")}
        </Link>
      </div>

      <div className="card overflow-hidden">
        <QuotationFilters q={params.q} from={params.from} to={params.to} />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">{t("colQtNumber")}</th>
                <th className="px-4 py-3 font-medium">{t("colSupplier")}</th>
                <th className="px-4 py-3 font-medium">{t("colDescription")}</th>
                <th className="px-4 py-3 font-medium">{t("colOrderDate")}</th>
                <th className="px-4 py-3 font-medium">{t("colReceiveDate")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("colTotalAmount")}</th>
                <th className="px-4 py-3 font-medium">{t("colFile")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotations.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                    {t("empty")}
                  </td>
                </tr>
              )}
              {quotations.map((q) => (
                <QuotationRow key={q.id} quotation={q} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
