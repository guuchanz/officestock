"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2, FileText, Image as ImageIcon } from "lucide-react";
import { deleteRepairAttachmentAction } from "@/actions/repair.actions";

interface Attachment {
  id: number;
  fileUrl: string;
  fileName: string;
  mimeType: string;
}

export default function RepairAttachments({ attachments }: { attachments: Attachment[] }) {
  const t = useTranslations("RepairForm");
  const [removed, setRemoved] = useState<number[]>([]);
  const [busy, setBusy] = useState<number | null>(null);

  const visible = attachments.filter((a) => !removed.includes(a.id));
  if (visible.length === 0) return <p className="text-xs text-slate-400">{t("noAttachments")}</p>;

  async function remove(id: number) {
    if (!confirm(t("confirmDeleteAttachment"))) return;
    setBusy(id);
    const res = await deleteRepairAttachmentAction(id);
    if (res.success) setRemoved((prev) => [...prev, id]);
    setBusy(null);
  }

  return (
    <ul className="space-y-1.5">
      {visible.map((a) => (
        <li key={a.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
          {a.mimeType === "application/pdf"
            ? <FileText size={15} className="text-slate-400" />
            : <ImageIcon size={15} className="text-slate-400" />}
          <a href={a.fileUrl} target="_blank" rel="noreferrer" className="flex-1 truncate text-sm text-blue-600 hover:underline">
            {a.fileName}
          </a>
          <button
            type="button" onClick={() => remove(a.id)} disabled={busy === a.id}
            className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}
