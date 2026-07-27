"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2, FileText, Image as ImageIcon, Pencil, Check, X } from "lucide-react";
import {
  deleteRepairAttachmentAction,
  renameRepairAttachmentAction,
} from "@/actions/repair.actions";

interface Attachment {
  id: number;
  docName: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
}

export default function RepairAttachments({ attachments }: { attachments: Attachment[] }) {
  const t = useTranslations("RepairForm");
  const tc = useTranslations("Common");
  const [removed, setRemoved] = useState<number[]>([]);
  const [renamed, setRenamed] = useState<Record<number, string>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");

  const visible = attachments.filter((a) => !removed.includes(a.id));
  if (visible.length === 0) return <p className="text-xs text-slate-400">{t("noAttachments")}</p>;

  async function remove(id: number) {
    if (!confirm(t("confirmDeleteAttachment"))) return;
    setBusy(id);
    setError("");
    const res = await deleteRepairAttachmentAction(id);
    if (res.success) setRemoved((prev) => [...prev, id]);
    else setError(res.message);
    setBusy(null);
  }

  async function saveName(id: number) {
    setBusy(id);
    setError("");
    const res = await renameRepairAttachmentAction(id, draft);
    if (res.success) {
      setRenamed((prev) => ({ ...prev, [id]: draft.trim() }));
      setEditing(null);
    } else {
      setError(res.message);
    }
    setBusy(null);
  }

  return (
    <>
      {error && <p className="mb-1.5 text-xs text-red-600">{error}</p>}
      <ul className="space-y-1.5">
        {visible.map((a) => {
          const label = renamed[a.id] ?? a.docName ?? a.fileName;
          return (
            <li key={a.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
              {a.mimeType === "application/pdf"
                ? <FileText size={15} className="shrink-0 text-slate-400" />
                : <ImageIcon size={15} className="shrink-0 text-slate-400" />}

              {editing === a.id ? (
                <>
                  <input
                    className="input flex-1 py-1.5"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      // The picker sits inside the repair form; Enter here must
                      // rename, not submit the whole job.
                      if (e.key === "Enter") { e.preventDefault(); saveName(a.id); }
                    }}
                    autoFocus
                  />
                  <button type="button" onClick={() => saveName(a.id)} disabled={busy === a.id}
                    className="p-1 text-slate-400 hover:text-green-600 disabled:opacity-50">
                    <Check size={15} />
                  </button>
                  <button type="button" onClick={() => setEditing(null)}
                    className="p-1 text-slate-400 hover:text-slate-700">
                    <X size={15} />
                  </button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <a href={a.fileUrl} target="_blank" rel="noreferrer"
                      className="block truncate text-sm text-blue-600 hover:underline">
                      {label}
                    </a>
                    {label !== a.fileName && (
                      <p className="truncate text-[11px] text-slate-400">{a.fileName}</p>
                    )}
                  </div>
                  <button type="button" onClick={() => { setEditing(a.id); setDraft(label); }}
                    className="p-1 text-slate-400 hover:text-blue-600" title={t("renameAttachment")}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" onClick={() => remove(a.id)} disabled={busy === a.id}
                    className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-50" title={tc("delete")}>
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
