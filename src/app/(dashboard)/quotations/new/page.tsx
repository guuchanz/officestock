import QuotationForm from "@/components/quotations/QuotationForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function NewQuotationPage() {
  const t = await getTranslations("Quotations");

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/quotations" className="btn-ghost p-2">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t("addNew")}</h1>
          <p className="text-sm text-slate-500">{t("addNewSubtitle")}</p>
        </div>
      </div>

      <div className="card p-6">
        <QuotationForm />
      </div>
    </div>
  );
}
