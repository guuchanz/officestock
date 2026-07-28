"use client";

import { useActionState, useTransition } from "react";
import { Paperclip, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { addUpdateAction, deleteUpdateAction } from "@/actions/projectUpdate.actions";
import type { ProjectActionState, ProjectDetail } from "@/actions/project.actions";

const EMPTY: ProjectActionState = { success: false, message: "" };

const money = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function UpdateLog({ project }: { project: ProjectDetail }) {
  const t = useTranslations("ProjectUpdates");
  const [state, formAction, pending] = useActionState(
    addUpdateAction.bind(null, project.id),
    EMPTY
  );
  const [busy, start] = useTransition();

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-2">
        <textarea name="note" rows={2} className="input" placeholder={t("notePlaceholder")} required />
        <div className="flex flex-wrap gap-2">
          <input name="cost" type="number" step="0.01" min="0" defaultValue={0}
                 className="input w-32" aria-label={t("cost")} />
          {/* One docNames input per file, in FileList order — pairFilesWithNames zips by index. */}
          <input name="files" type="file" multiple accept="application/pdf" className="input flex-1" />
          <input name="docNames" className="input w-40" placeholder={t("fileLabel")} />
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? t("posting") : t("post")}
          </button>
        </div>
        {state.message && !state.success && (
          <p className="text-xs text-red-600">{state.message}</p>
        )}
      </form>

      <ul className="divide-y divide-slate-100">
        {project.updates.map((u) => (
          <li key={u.id} className="py-3 space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs text-slate-500">
                {u.createdAt.toLocaleDateString("th-TH")} · {u.authorName}
                {u.cost > 0 && <span className="ml-2 font-medium text-slate-700">{money(u.cost)}</span>}
              </div>
              <button
                onClick={() => start(async () => { await deleteUpdateAction(u.id); })}
                disabled={busy}
                aria-label={t("delete")}
                className="text-slate-300 hover:text-red-600 shrink-0"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{u.note}</p>
            {u.attachments.length > 0 && (
              <ul className="flex flex-wrap gap-2 pt-1">
                {u.attachments.map((a) => (
                  <li key={a.id}>
                    <a href={a.fileUrl} target="_blank" rel="noreferrer"
                       className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline">
                      <Paperclip size={12} />{a.docName || a.fileName}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {project.updates.length === 0 && (
          <li className="py-3 text-sm text-slate-400">{t("empty")}</li>
        )}
      </ul>
    </div>
  );
}
