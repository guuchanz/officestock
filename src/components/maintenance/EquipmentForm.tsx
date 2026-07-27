"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { Save, Loader2, ExternalLink } from "lucide-react";
import {
  createEquipmentAction,
  updateEquipmentAction,
  type EquipmentActionState,
} from "@/actions/equipment.actions";
import { INTERVAL_PRESETS, addMonths } from "@/lib/maintenance-constants";

const initState: EquipmentActionState = { success: false, message: "" };

interface Option { id: number; name: string; isActive?: boolean }

export interface EquipmentFormValues {
  id: number;
  assetNo: string;
  name: string;
  model: string | null;
  serialNo: string | null;
  detail: string | null;
  factoryId: number | null;
  areaId: number | null;
  technicianId: number | null;
  intervalMonths: number;
  baselineAt: Date;
  isActive: boolean;
  note: string | null;
}

interface Props {
  factories: Option[];
  areas: Option[];
  technicians: Option[];
  equipment?: EquipmentFormValues;
}

const dateValue = (d: Date) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
};

export default function EquipmentForm({ factories, areas, technicians, equipment }: Props) {
  const t = useTranslations("EquipmentForm");
  const tc = useTranslations("Common");
  const router = useRouter();
  const editing = Boolean(equipment);

  const [state, formAction, pending] = useActionState(
    editing ? updateEquipmentAction : createEquipmentAction,
    initState
  );

  const [interval, setInterval] = useState(equipment?.intervalMonths ?? 3);
  const [baseline, setBaseline] = useState(
    dateValue(equipment?.baselineAt ?? new Date())
  );

  // Mirrors the server rule so the user sees the consequence before saving.
  const preview = (() => {
    const d = new Date(baseline);
    if (Number.isNaN(d.getTime()) || !interval) return null;
    return addMonths(d, interval).toLocaleDateString("th-TH");
  })();

  if (state.success && !editing) {
    router.push("/maintenance");
  }

  const err = (field: string) => state.errors?.[field]?.[0];

  return (
    <form action={formAction} className="space-y-5">
      {editing && <input type="hidden" name="id" value={equipment!.id} />}

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">{t("sectionAsset")}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="assetNo">{t("assetNoLabel")} *</label>
            <input id="assetNo" name="assetNo" className="input" required
              defaultValue={equipment?.assetNo} placeholder={t("assetNoPlaceholder")} />
            {err("assetNo") && <p className="mt-1 text-xs text-red-600">{err("assetNo")}</p>}
          </div>
          <div>
            <label className="label" htmlFor="name">{t("nameLabel")} *</label>
            <input id="name" name="name" className="input" required
              defaultValue={equipment?.name} placeholder={t("namePlaceholder")} />
            {err("name") && <p className="mt-1 text-xs text-red-600">{err("name")}</p>}
          </div>
          <div>
            <label className="label" htmlFor="model">{t("modelLabel")}</label>
            <input id="model" name="model" className="input" defaultValue={equipment?.model ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="serialNo">{t("serialNoLabel")}</label>
            <input id="serialNo" name="serialNo" className="input" defaultValue={equipment?.serialNo ?? ""} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="detail">{t("detailLabel")}</label>
          <textarea id="detail" name="detail" rows={3} className="input"
            defaultValue={equipment?.detail ?? ""} placeholder={t("detailPlaceholder")} />
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">{t("sectionLocation")}</h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="factoryId">{t("factoryLabel")}</label>
            <select id="factoryId" name="factoryId" className="input" defaultValue={equipment?.factoryId ?? ""}>
              <option value="">{t("none")}</option>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="areaId">{t("areaLabel")}</label>
            <select id="areaId" name="areaId" className="input" defaultValue={equipment?.areaId ?? ""}>
              <option value="">{t("none")}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label flex items-center justify-between" htmlFor="technicianId">
              <span>{t("inchargeLabel")}</span>
              <Link href="/maintenance/technicians" className="text-[11px] font-normal text-blue-600 hover:underline inline-flex items-center gap-0.5">
                {t("manageList")}<ExternalLink size={10} />
              </Link>
            </label>
            <select id="technicianId" name="technicianId" className="input" defaultValue={equipment?.technicianId ?? ""}>
              <option value="">{t("none")}</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>{tech.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">{t("sectionSchedule")}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="intervalMonths">{t("intervalLabel")} *</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {INTERVAL_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setInterval(m)}
                  className={clsx(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    interval === m
                      ? "bg-[#1e3a5f] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {t("everyMonths", { months: m })}
                </button>
              ))}
            </div>
            <input
              id="intervalMonths" name="intervalMonths" type="number" min={1} max={120} required
              className="input" value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
            />
            {err("intervalMonths") && <p className="mt-1 text-xs text-red-600">{err("intervalMonths")}</p>}
          </div>

          <div>
            <label className="label" htmlFor="baselineAt">{t("baselineLabel")} *</label>
            <input
              id="baselineAt" name="baselineAt" type="date" required className="input"
              value={baseline} onChange={(e) => setBaseline(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400">{t("baselineHint")}</p>
            {err("baselineAt") && <p className="mt-1 text-xs text-red-600">{err("baselineAt")}</p>}
          </div>
        </div>

        {preview && (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
            {t("nextDuePreview", { date: preview })}
          </p>
        )}

        <div>
          <label className="label" htmlFor="note">{t("noteLabel")}</label>
          <textarea id="note" name="note" rows={2} className="input" defaultValue={equipment?.note ?? ""} />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="isActive" value="true" defaultChecked={equipment?.isActive ?? true} />
          {t("activeLabel")}
        </label>
        <input type="hidden" name="isActive" value="false" />
      </div>

      {state.message && (
        <p className={clsx(
          "text-sm font-medium rounded-lg px-3 py-2",
          state.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        )}>
          {state.success ? "✅ " : "❌ "}{state.message}
        </p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={clsx("btn-primary", pending && "opacity-60 cursor-not-allowed")}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {pending ? tc("saving") : tc("save")}
        </button>
        <Link href="/maintenance" className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
          {tc("cancel")}
        </Link>
      </div>
    </form>
  );
}
