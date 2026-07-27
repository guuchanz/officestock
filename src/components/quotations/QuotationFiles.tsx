"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, Trash2 } from "lucide-react";
import { deleteQuotationFileAction } from "@/actions/quotation.actions";

export interface QuotationFileItem {
  id: number;
  docName: string;
  fileUrl: string;
  fileName: string;
}

/**
 * Existing files on the edit form: click the name to open, trash to remove.
 * New files are added by the FilePicker below it, so an edit never has to
 * re-upload the ones that are already attached.
 */
export default function QuotationFiles({ files }: { files: QuotationFileItem[] }) {
  const t = useTranslations("Quotations");
  const tc = useTranslations("Common");
  const [removed, setRemoved] = useState<number[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");

  const visible = files.filter((f) => !removed.includes(f.id));
  if (visible.length === 0) return <p className="text-xs text-slate-400">{t("noFiles")}</p>;

  async function remove(id: number, name: string) {
    if (!confirm(t("confirmDeleteFile", { name }))) return;
    setBusy(id);
    setError("");
    const res = await deleteQuotationFileAction(id);
    if (res.success) setRemoved((prev) => [...prev, id]);
    else setError(res.message);
    setBusy(null);
  }

  return (
    <>
      {error && <p className="mb-1.5 text-xs text-red-600">{error}</p>}
      <ul className="space-y-1.5">
        {visible.map((f) => (
          <li key={f.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <FileText size={15} className="shrink-0 text-slate-400" />
            <div className="min-w-0 flex-1">
              <a href={f.fileUrl} target="_blank" rel="noreferrer"
                className="block truncate text-sm text-blue-600 hover:underline">
                {f.docName || f.fileName}
              </a>
              {f.docName !== f.fileName && (
                <p className="truncate text-[11px] text-slate-400">{f.fileName}</p>
              )}
            </div>
            <button type="button" onClick={() => remove(f.id, f.docName || f.fileName)}
              disabled={busy === f.id}
              className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-50" title={tc("delete")}>
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
