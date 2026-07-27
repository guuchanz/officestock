"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { Upload, Loader2, Trash2, FileText, Image as ImageIcon, Pencil, Check, X } from "lucide-react";
import {
  uploadEquipmentDocumentAction,
  renameEquipmentDocumentAction,
  deleteEquipmentDocumentAction,
  type EquipmentDocumentActionState,
} from "@/actions/equipmentDocument.actions";

const initState: EquipmentDocumentActionState = { success: false, message: "" };

export interface EquipmentDocumentItem {
  id: number;
  docName: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  createdAt: Date;
}

interface Props {
  equipmentId: number;
  documents: EquipmentDocumentItem[];
}

export default function EquipmentDocuments({ equipmentId, documents }: Props) {
  const t = useTranslations("EquipmentDocuments");
  const tc = useTranslations("Common");
  const [state, formAction, pending] = useActionState(uploadEquipmentDocumentAction, initState);
  const formRef = useRef<HTMLFormElement>(null);

  const [removed, setRemoved] = useState<number[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [rowError, setRowError] = useState("");

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  const visible = documents.filter((d) => !removed.includes(d.id));

  async function remove(id: number, name: string) {
    if (!confirm(t("confirmDelete", { name }))) return;
    setBusy(id);
    setRowError("");
    const res = await deleteEquipmentDocumentAction(id);
    if (res.success) setRemoved((prev) => [...prev, id]);
    else setRowError(res.message);
    setBusy(null);
  }

  async function saveName(id: number) {
    setBusy(id);
    setRowError("");
    const res = await renameEquipmentDocumentAction(id, draft);
    if (res.success) setEditing(null);
    else setRowError(res.message);
    setBusy(null);
  }

  return (
    <div>
      <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3 p-5 border-b border-slate-100">
        <input type="hidden" name="equipmentId" value={equipmentId} />

        <div className="flex-1 min-w-[200px]">
          <label className="label" htmlFor="docName">{t("docNameLabel")} *</label>
          <input
            id="docName" name="docName" className="input" required
            placeholder={t("docNamePlaceholder")}
          />
          {state.errors?.docName?.[0] && (
            <p className="mt-1 text-xs text-red-600">{state.errors.docName[0]}</p>
          )}
        </div>

        <div className="flex-1 min-w-[220px]">
          <label className="label" htmlFor="file">{t("fileLabel")} *</label>
          <input
            id="file" name="file" type="file" required className="input py-2"
            accept="application/pdf"
          />
          <p className="mt-1 text-xs text-slate-400">{t("fileHint")}</p>
        </div>

        <button type="submit" disabled={pending} className={clsx("btn-primary py-2.5", pending && "opacity-60 cursor-not-allowed")}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {pending ? tc("saving") : t("upload")}
        </button>

        {state.message && (
          <p className={clsx(
            "w-full text-sm font-medium rounded-lg px-3 py-2",
            state.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          )}>
            {state.success ? "✅ " : "❌ "}{state.message}
          </p>
        )}
      </form>

      {rowError && <p className="px-5 pt-3 text-xs text-red-600">{rowError}</p>}

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {visible.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-5 py-3">
              {doc.mimeType === "application/pdf"
                ? <FileText size={16} className="shrink-0 text-slate-400" />
                : <ImageIcon size={16} className="shrink-0 text-slate-400" />}

              {editing === doc.id ? (
                <>
                  <input
                    className="input flex-1 py-1.5"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveName(doc.id); }}
                    autoFocus
                  />
                  <button onClick={() => saveName(doc.id)} disabled={busy === doc.id} className="p-1.5 text-slate-400 hover:text-green-600 disabled:opacity-50">
                    <Check size={15} />
                  </button>
                  <button onClick={() => setEditing(null)} className="p-1.5 text-slate-400 hover:text-slate-700">
                    <X size={15} />
                  </button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-blue-600 hover:underline">
                      {doc.docName}
                    </a>
                    <p className="truncate text-[11px] text-slate-400">
                      {doc.fileName} · {new Date(doc.createdAt).toLocaleDateString("th-TH")}
                    </p>
                  </div>
                  <button
                    onClick={() => { setEditing(doc.id); setDraft(doc.docName); }}
                    className="p-1.5 text-slate-400 hover:text-blue-600"
                    title={t("rename")}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => remove(doc.id, doc.docName)}
                    disabled={busy === doc.id}
                    className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-50"
                    title={tc("delete")}
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
