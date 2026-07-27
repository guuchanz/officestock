"use client";

import { useState, useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { Pencil, Trash2, Check, X } from "lucide-react";
import {
  updateTechnicianAction,
  deleteTechnicianAction,
  type TechnicianActionState,
} from "@/actions/technician.actions";

const initState: TechnicianActionState = { success: false, message: "" };

interface Props {
  technician: { id: number; name: string; phone: string | null; isActive: boolean };
}

export default function TechnicianRow({ technician }: Props) {
  const t = useTranslations("Technicians");
  const tc = useTranslations("Common");
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [state, formAction, pending] = useActionState(updateTechnicianAction, initState);

  useEffect(() => {
    if (state.success) setEditing(false);
  }, [state.success]);

  async function handleDelete() {
    if (!confirm(t("confirmDelete", { name: technician.name }))) return;
    setDeleting(true);
    setError("");
    const res = await deleteTechnicianAction(technician.id);
    if (!res.success) setError(res.message);
    setDeleting(false);
  }

  if (editing) {
    return (
      <tr className="bg-blue-50/40">
        <td colSpan={4} className="px-5 py-3">
          <form action={formAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={technician.id} />
            <input name="name" className="input flex-1 min-w-[160px]" defaultValue={technician.name} required />
            <input name="phone" className="input flex-1 min-w-[130px]" defaultValue={technician.phone ?? ""} />
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <input type="checkbox" name="isActive" value="true" defaultChecked={technician.isActive} />
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
      <td className="px-5 py-3 font-medium text-slate-800">{technician.name}</td>
      <td className="px-4 py-3 text-slate-600">{technician.phone || "-"}</td>
      <td className="px-4 py-3">
        <span className={clsx(
          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
          technician.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
        )}>
          {technician.isActive ? t("active") : t("inactive")}
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
