"use client";

import { useState, useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { Pencil, Trash2, Check, X } from "lucide-react";
import {
  updateAreaAction,
  deleteAreaAction,
  type AreaActionState,
} from "@/actions/area.actions";

const initState: AreaActionState = { success: false, message: "" };

interface Props {
  area: { id: number; name: string; isActive: boolean };
}

export default function AreaRow({ area }: Props) {
  const t = useTranslations("Areas");
  const tc = useTranslations("Common");
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [state, formAction, pending] = useActionState(updateAreaAction, initState);

  useEffect(() => {
    if (state.success) setEditing(false);
  }, [state.success]);

  async function handleDelete() {
    if (!confirm(t("confirmDelete", { name: area.name }))) return;
    setDeleting(true);
    setError("");
    const res = await deleteAreaAction(area.id);
    if (!res.success) setError(res.message);
    setDeleting(false);
  }

  if (editing) {
    return (
      <tr className="bg-blue-50/40">
        <td colSpan={3} className="px-5 py-3">
          <form action={formAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={area.id} />
            <input name="name" className="input flex-1 min-w-[180px]" defaultValue={area.name} required />
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <input type="checkbox" name="isActive" value="true" defaultChecked={area.isActive} />
              {t("active")}
            </label>
            <input type="hidden" name="isActive" value="false" />
            <button type="submit" disabled={pending} className="btn-primary py-2">
              <Check size={15} />{pending ? tc("saving") : tc("save")}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
              <X size={15} />
            </button>
            {state.message && !state.success && (
              <span className="text-xs text-red-600">{state.message}</span>
            )}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-5 py-3 font-medium text-slate-800">{area.name}</td>
      <td className="px-4 py-3">
        <span className={clsx(
          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
          area.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
        )}>
          {area.isActive ? t("active") : t("inactive")}
        </span>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
      <td className="px-5 py-3 text-right">
        <button onClick={() => setEditing(true)} className="p-1.5 text-slate-400 hover:text-blue-600" title={tc("edit")}>
          <Pencil size={15} />
        </button>
        <button onClick={handleDelete} disabled={deleting} className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-50" title={tc("delete")}>
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
}
