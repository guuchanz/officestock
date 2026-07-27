"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { Wrench, Loader2 } from "lucide-react";
import { MaintResult } from "@prisma/client";
import {
  createMaintenanceLogAction,
  type MaintenanceLogActionState,
} from "@/actions/maintenanceLog.actions";
import { round2 } from "@/lib/parts";
import PartsEditor from "@/components/common/PartsEditor";

const initState: MaintenanceLogActionState = { success: false, message: "" };

interface Option { id: number; name: string }

interface Props {
  equipmentId: number;
  technicians: Option[];
  defaultTechnicianId?: number | null;
}

const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export default function ServiceLogForm({ equipmentId, technicians, defaultTechnicianId }: Props) {
  const t = useTranslations("ServiceLogForm");
  const tc = useTranslations("Common");
  const [state, formAction, pending] = useActionState(createMaintenanceLogAction, initState);
  const formRef = useRef<HTMLFormElement>(null);
  // Bumping the key remounts PartsEditor so its internal rows clear on success.
  const [resetKey, setResetKey] = useState(0);

  const [partsSubtotal, setPartsSubtotal] = useState(0);
  const [labour, setLabour] = useState("0");

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setPartsSubtotal(0);
      setLabour("0");
      setResetKey((k) => k + 1);
    }
  }, [state.success]);

  // Mirrors the server calculation so the number on screen is the number saved.
  const grandTotal = round2(partsSubtotal + (Number(labour) > 0 ? Number(labour) : 0));
  const money = (n: number) =>
    n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const err = (field: string) => state.errors?.[field]?.[0];

  return (
    <form ref={formRef} action={formAction} className="space-y-4 p-5">
      <input type="hidden" name="equipmentId" value={equipmentId} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="performedAt">{t("dateLabel")} *</label>
          <input id="performedAt" name="performedAt" type="date" required className="input" defaultValue={today()} />
          {err("performedAt") && <p className="mt-1 text-xs text-red-600">{err("performedAt")}</p>}
        </div>
        <div>
          <label className="label" htmlFor="logTechnicianId">{t("technicianLabel")}</label>
          <select id="logTechnicianId" name="technicianId" className="input" defaultValue={defaultTechnicianId ?? ""}>
            <option value="">{t("none")}</option>
            {technicians.map((tech) => (
              <option key={tech.id} value={tech.id}>{tech.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="result">{t("resultLabel")}</label>
          <select id="result" name="result" className="input" defaultValue={MaintResult.OK}>
            {Object.values(MaintResult).map((r) => (
              <option key={r} value={r}>{t(`result${r}`)}</option>
            ))}
          </select>
        </div>
      </div>

      <PartsEditor key={resetKey} onSubtotalChange={setPartsSubtotal} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="labourCost">{t("labourLabel")}</label>
          <input
            id="labourCost" name="labourCost" type="number" step="0.01" min="0"
            className="input text-right" value={labour}
            onChange={(e) => setLabour(e.target.value)}
          />
          {err("labourCost") && <p className="mt-1 text-xs text-red-600">{err("labourCost")}</p>}
        </div>
        <div className="flex items-end">
          <div className="w-full rounded-lg bg-slate-50 px-3 py-2.5 text-right">
            <span className="text-xs text-slate-500">{t("totalLabel")}</span>
            <span className="ml-2 text-lg font-bold text-slate-900">{money(grandTotal)}</span>
          </div>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="logNote">{t("noteLabel")}</label>
        <textarea id="logNote" name="note" rows={2} className="input" />
      </div>

      {state.message && (
        <p className={clsx(
          "text-sm font-medium rounded-lg px-3 py-2",
          state.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        )}>
          {state.success ? "✅ " : "❌ "}{state.message}
        </p>
      )}

      <button type="submit" disabled={pending} className={clsx("btn-primary", pending && "opacity-60 cursor-not-allowed")}>
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Wrench size={16} />}
        {pending ? tc("saving") : t("submit")}
      </button>
    </form>
  );
}
