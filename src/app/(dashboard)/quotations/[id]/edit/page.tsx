import { getQuotationById } from "@/actions/quotation.actions";
import QuotationForm from "@/components/quotations/QuotationForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

export default async function EditQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quotationId = Number(id);
  if (!quotationId) notFound();

  const [quotation, t] = await Promise.all([
    getQuotationById(quotationId),
    getTranslations("Quotations"),
  ]);

  if (!quotation) notFound();

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/quotations" className="btn-ghost p-2">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t("editTitle")}</h1>
          <p className="text-sm text-slate-500">{quotation.supplierName}</p>
        </div>
      </div>

      <div className="card p-6">
        <QuotationForm quotation={quotation} />
      </div>
    </div>
  );
}
