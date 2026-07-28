"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createProjectAction, updateProjectAction,
  type ProjectActionState, type ProjectDetail,
} from "@/actions/project.actions";
import { PROJECT_STATUSES, PROJECT_PRIORITIES } from "@/lib/project-constants";

const EMPTY: ProjectActionState = { success: false, message: "" };

/** yyyy-mm-dd for <input type="date">, in local time. */
function isoDate(d: Date | null): string {
  if (!d) return "";
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}

/**
 * There is no owner field: the owner is the signed-in user, set server-side
 * on create and never reassigned by an edit.
 */
export default function ProjectForm({
  departments,
  project,
}: {
  departments: { id: number; name: string }[];
  project?: ProjectDetail;
}) {
  const t = useTranslations("ProjectForm");
  const tp = useTranslations("Projects");
  const router = useRouter();

  const action = project
    ? updateProjectAction.bind(null, project.id)
    : createProjectAction;
  const [state, formAction, pending] = useActionState(action, EMPTY);

  useEffect(() => {
    if (state.success) router.push(project ? `/projects/${project.id}` : "/projects");
  }, [state.success, project, router]);

  return (
    <form action={formAction} className="card p-6 space-y-4 max-w-3xl">
      {state.message && !state.success && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      <div>
        <label className="label" htmlFor="name">{t("name")}</label>
        <input id="name" name="name" className="input" required
               defaultValue={project?.name ?? ""} />
        {state.errors?.name && <p className="text-xs text-red-600 mt-1">{state.errors.name[0]}</p>}
      </div>

      <div>
        <label className="label" htmlFor="details">{t("details")}</label>
        <textarea id="details" name="details" rows={4} className="input"
                  defaultValue={project?.details ?? ""} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="startDate">{t("startDate")}</label>
          <input id="startDate" name="startDate" type="date" className="input" required
                 defaultValue={isoDate(project?.startDate ?? null)} />
          {state.errors?.startDate && <p className="text-xs text-red-600 mt-1">{state.errors.startDate[0]}</p>}
        </div>
        <div>
          <label className="label" htmlFor="dueDate">{t("dueDate")}</label>
          <input id="dueDate" name="dueDate" type="date" className="input"
                 defaultValue={isoDate(project?.dueDate ?? null)} />
          {state.errors?.dueDate && <p className="text-xs text-red-600 mt-1">{state.errors.dueDate[0]}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="departmentId">{t("department")}</label>
          <select id="departmentId" name="departmentId" className="input"
                  defaultValue={project?.departmentId ?? ""}>
            <option value="">{t("none")}</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="requestor">{t("requestor")}</label>
          <input id="requestor" name="requestor" className="input"
                 placeholder={t("requestorPlaceholder")}
                 defaultValue={project?.requestor ?? ""} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="status">{t("status")}</label>
          <select id="status" name="status" className="input" defaultValue={project?.status ?? "PLANNING"}>
            {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{tp(`status${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="priority">{t("priority")}</label>
          <select id="priority" name="priority" className="input" defaultValue={project?.priority ?? "MEDIUM"}>
            {PROJECT_PRIORITIES.map((p) => <option key={p} value={p}>{tp(`priority${p}`)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="budget">{t("budget")}</label>
          <input id="budget" name="budget" type="number" step="0.01" min="0" className="input"
                 defaultValue={project?.budget ?? 0} />
          {state.errors?.budget && <p className="text-xs text-red-600 mt-1">{state.errors.budget[0]}</p>}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="atRisk" defaultChecked={project?.atRisk ?? false} />
        {t("atRisk")}
      </label>

      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}
