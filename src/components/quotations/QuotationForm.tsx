"use client";

import { useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { createQuotationAction, updateQuotationAction, type QuotationActionState } from "@/actions/quotation.actions";

const initState: QuotationActionState = { success: false, message: "" };

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

interface QuotationFormProps {
  quotation?: {
    id:           number;
    qtNumber:     string;
    supplierName: string;
    description:  string | null;
    orderDate:    Date;
    receiveDate:  Date | null;
    totalAmount:  number;
    fileName:     string;
  };
}

export default function QuotationForm({ quotation }: QuotationFormProps) {
  const t  = useTranslations("QuotationForm");
  const tc = useTranslations("Common");
  const isEdit = !!quotation;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateQuotationAction : createQuotationAction,
    initState
  );
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.push("/quotations");
  }, [state.success, router]);

  const fieldError = (field: string) => state.errors?.[field]?.[0];

  return (
    <form action={formAction} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={quotation.id} />}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="qtNumber">{t("qtNumberLabel")}</label>
          <input
            id="qtNumber" name="qtNumber" className="input"
            placeholder={t("qtNumberPlaceholder")} defaultValue={quotation?.qtNumber} required
          />
          {fieldError("qtNumber") && <p className="mt-1 text-xs text-red-600">{fieldError("qtNumber")}</p>}
        </div>
        <div>
          <label className="label" htmlFor="supplierName">{t("supplierNameLabel")}</label>
          <input
            id="supplierName" name="supplierName" className="input"
            placeholder={t("supplierNamePlaceholder")} defaultValue={quotation?.supplierName} required
          />
          {fieldError("supplierName") && <p className="mt-1 text-xs text-red-600">{fieldError("supplierName")}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="totalAmount">{t("totalAmountLabel")}</label>
          <input
            id="totalAmount" name="totalAmount" type="number" min={0} step="0.01"
            className="input" placeholder="0.00" defaultValue={quotation?.totalAmount} required
          />
          {fieldError("totalAmount") && <p className="mt-1 text-xs text-red-600">{fieldError("totalAmount")}</p>}
        </div>
        <div>
          <label className="label" htmlFor="orderDate">{t("orderDateLabel")}</label>
          <input
            id="orderDate" name="orderDate" type="date" className="input"
            defaultValue={toDateInputValue(quotation?.orderDate)} required
          />
          {fieldError("orderDate") && <p className="mt-1 text-xs text-red-600">{fieldError("orderDate")}</p>}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="description">{t("descriptionLabel")}</label>
        <textarea
          id="description" name="description" rows={2} className="input resize-none"
          placeholder={t("descriptionPlaceholder")} defaultValue={quotation?.description ?? ""}
        />
      </div>

      <div>
        <label className="label" htmlFor="receiveDate">{t("receiveDateLabel")}</label>
        <input
          id="receiveDate" name="receiveDate" type="date" className="input"
          defaultValue={toDateInputValue(quotation?.receiveDate)}
        />
        {fieldError("receiveDate") && <p className="mt-1 text-xs text-red-600">{fieldError("receiveDate")}</p>}
      </div>

      <div>
        <label className="label" htmlFor="file">
          {t("fileLabel")}{isEdit && <span className="text-slate-400 font-normal"> {t("fileEditHint")}</span>}
        </label>
        {isEdit && <p className="mb-2 text-xs text-slate-500 truncate">{t("currentFile")}: {quotation.fileName}</p>}
        <input id="file" name="file" type="file" accept="application/pdf" className="input" required={!isEdit} />
        {fieldError("file") && <p className="mt-1 text-xs text-red-600">{fieldError("file")}</p>}
      </div>

      {state.message && (
        <p
          className={clsx(
            "text-sm font-medium rounded-lg px-3 py-2",
            state.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          )}
        >
          {state.success ? "✅ " : "❌ "}{state.message}
        </p>
      )}

      <div className="pt-2 flex gap-3">
        <Link href="/quotations" className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors text-center">
          {tc("cancel")}
        </Link>
        <button type="submit" disabled={pending} className={clsx("btn-primary flex-1 justify-center py-2.5", pending && "opacity-60 cursor-not-allowed")}>
          {pending ? tc("saving") : isEdit ? t("saveEdit") : t("add")}
        </button>
      </div>
    </form>
  );
}
