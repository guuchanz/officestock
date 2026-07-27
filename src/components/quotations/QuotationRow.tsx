"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { useTranslations, useLocale } from "next-intl";
import { FileText, Trash2, Pencil } from "lucide-react";
import { deleteQuotationAction } from "@/actions/quotation.actions";
import Spinner from "@/components/ui/Spinner";

interface QuotationRowProps {
  quotation: {
    id:           number;
    qtNumber:     string;
    supplierName: string;
    description:  string | null;
    orderDate:    Date;
    receiveDate:  Date | null;
    totalAmount:  number;
    fileUrl:      string | null;
    fileName:     string | null;
    files:        { id: number; docName: string; fileUrl: string; fileName: string }[];
  };
}

export default function QuotationRow({ quotation }: QuotationRowProps) {
  const t     = useTranslations("Quotations");
  const tc    = useTranslations("Common");
  const locale = useLocale();
  const dateLocale = locale === "en" ? "en-US" : "th-TH";

  const [isDeleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState("");

  const handleDelete = () => {
    if (!window.confirm(t("confirmDelete", { supplier: quotation.supplierName }))) return;
    setDeleteError("");
    startDelete(async () => {
      const res = await deleteQuotationAction(quotation.id);
      if (!res.success) setDeleteError(res.message);
    });
  };

  return (
    <tr className="hover:bg-slate-50/70 transition-colors">
      <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{quotation.qtNumber || "—"}</td>
      <td className="px-4 py-3.5 font-medium text-slate-800">{quotation.supplierName}</td>
      <td className="px-4 py-3.5 text-slate-500 max-w-xs truncate">{quotation.description ?? "—"}</td>
      <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
        {new Date(quotation.orderDate).toLocaleDateString(dateLocale)}
      </td>
      <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
        {quotation.receiveDate ? new Date(quotation.receiveDate).toLocaleDateString(dateLocale) : "—"}
      </td>
      <td className="px-4 py-3.5 text-right text-slate-700 font-semibold tabular-nums whitespace-nowrap">
        {`฿${quotation.totalAmount.toLocaleString(dateLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      </td>
      <td className="px-4 py-3.5">
        {quotation.files.length === 0 ? (
          <span className="text-xs text-slate-300">—</span>
        ) : (
          <div className="space-y-0.5">
            {quotation.files.map((f) => (
              <a
                key={f.id}
                href={f.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={f.fileName}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-all w-fit max-w-[200px]"
              >
                <FileText size={14} className="shrink-0" />
                <span className="truncate">{f.docName || f.fileName}</span>
              </a>
            ))}
          </div>
        )}
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center justify-end gap-1">
          <Link href={`/quotations/${quotation.id}/edit`} className="btn-ghost p-1.5" title={tc("edit")}>
            <Pencil size={14} />
          </Link>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className={clsx("btn-ghost p-1.5 text-red-500", isDeleting && "opacity-60 cursor-not-allowed")}
            title={tc("delete")}
          >
            {isDeleting ? <Spinner size={14} /> : <Trash2 size={14} />}
          </button>
        </div>
        {deleteError && <p className="mt-1 text-xs text-red-600 text-right">{deleteError}</p>}
      </td>
    </tr>
  );
}
