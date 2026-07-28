"use client";

import { useActionState, useTransition } from "react";
import { Check, Circle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import {
  addMilestoneAction, toggleMilestoneAction, deleteMilestoneAction,
} from "@/actions/projectMilestone.actions";
import type { ProjectActionState, ProjectDetail } from "@/actions/project.actions";

const EMPTY: ProjectActionState = { success: false, message: "" };

export default function MilestoneEditor({ project }: { project: ProjectDetail }) {
  const t = useTranslations("ProjectMilestones");
  const [state, formAction, pending] = useActionState(
    addMilestoneAction.bind(null, project.id),
    EMPTY
  );
  const [busy, start] = useTransition();

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-slate-100">
        {project.milestones.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2">
            <button
              onClick={() => start(async () => { await toggleMilestoneAction(m.id); })}
              disabled={busy}
              aria-label={m.isDone ? t("markNotDone") : t("markDone")}
              className={clsx("shrink-0", m.isDone ? "text-emerald-600" : "text-slate-300 hover:text-slate-500")}
            >
              {m.isDone ? <Check size={18} /> : <Circle size={18} />}
            </button>
            <span className={clsx("flex-1 text-sm", m.isDone && "text-slate-400 line-through")}>
              {m.name}
            </span>
            <button
              onClick={() => start(async () => { await deleteMilestoneAction(m.id); })}
              disabled={busy}
              aria-label={t("delete")}
              className="text-slate-300 hover:text-red-600"
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
        {project.milestones.length === 0 && (
          <li className="py-3 text-sm text-slate-400">{t("empty")}</li>
        )}
      </ul>

      {state.message && !state.success && (
        <p className="text-xs text-red-600">{state.message}</p>
      )}

      <form action={formAction} className="flex flex-wrap gap-2">
        <input name="name" className="input flex-1 min-w-[10rem]" placeholder={t("namePlaceholder")} required />
        <input name="startDate" type="date" className="input w-auto" aria-label={t("startDate")} />
        <input name="endDate" type="date" className="input w-auto" aria-label={t("endDate")} />
        <button type="submit" className="btn-primary" disabled={pending}>{t("add")}</button>
      </form>
    </div>
  );
}
