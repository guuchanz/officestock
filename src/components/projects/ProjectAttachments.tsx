"use client";

import { useActionState, useTransition } from "react";
import { Paperclip, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  addProjectFilesAction, deleteProjectAttachmentAction,
} from "@/actions/projectUpdate.actions";
import type { ProjectActionState, ProjectDetail } from "@/actions/project.actions";

const EMPTY: ProjectActionState = { success: false, message: "" };

// Own namespace, not the shared `Attachments` one — that is used by the repair
// and equipment modules and has a different key set (docNameLabel, hint, ...).
export default function ProjectAttachments({ project }: { project: ProjectDetail }) {
  const t = useTranslations("ProjectFiles");
  const [state, formAction, pending] = useActionState(
    addProjectFilesAction.bind(null, project.id),
    EMPTY
  );
  const [busy, start] = useTransition();

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-slate-100">
        {project.files.map((f) => (
          <li key={f.id} className="flex items-center gap-2 py-2 text-sm">
            <Paperclip size={14} className="text-slate-400 shrink-0" />
            <a href={f.fileUrl} target="_blank" rel="noreferrer" className="flex-1 text-blue-700 hover:underline truncate">
              {f.docName || f.fileName}
            </a>
            <button
              onClick={() => start(async () => { await deleteProjectAttachmentAction(f.id); })}
              disabled={busy}
              aria-label={t("delete")}
              className="text-slate-300 hover:text-red-600"
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
        {project.files.length === 0 && <li className="py-2 text-sm text-slate-400">{t("empty")}</li>}
      </ul>

      <form action={formAction} className="flex flex-wrap gap-2">
        <input name="files" type="file" multiple accept="application/pdf" className="input flex-1" />
        <input name="docNames" className="input w-40" placeholder={t("labelPlaceholder")} />
        <button type="submit" className="btn-primary" disabled={pending}>{t("upload")}</button>
      </form>
      {state.message && !state.success && <p className="text-xs text-red-600">{state.message}</p>}
    </div>
  );
}
