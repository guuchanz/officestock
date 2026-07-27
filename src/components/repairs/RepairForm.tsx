"use client";

import { useEffect, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { RepairStatus, RepairType } from "@prisma/client";
import {
  createRepairAction, updateRepairAction, type RepairActionState,
} from "@/actions/repair.actions";
import RepairAttachments from "./RepairAttachments";

const initState: RepairActionState = { success: false, message: "" };

function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return new Date().toISOString().slice(0, 10);
  return new Date(date).toISOString().slice(0, 10);
}

interface RepairFormProps {
  departments: { id: number; name: string }[];
  technicians: { id: number; name: string; isActive: boolean }[];
  deviceTypes: { id: number; name: string; isActive: boolean }[];
  job?: {
    id: number;
    jobNumber: string;
    type: RepairType;
    departmentId: number | null;
    customerName: string | null;
    customerPhone: string | null;
    ownerName: string | null;
    ownerTel: string | null;
    deviceTypeId: number | null;
    deviceName: string;
    deviceModel: string | null;
    serialNo: string | null;
    serviceTag: string | null;
    expressNo: string | null;
    problem: string;
    partsUsed: string | null;
    partsCost: number;
    labourCost: number;
    status: RepairStatus;
    technicianId: number | null;
    reportedAt: Date;
    note: string | null;
    attachments: { id: number; fileUrl: string; fileName: string; mimeType: string }[];
  };
}

export default function RepairForm({ departments, technicians, deviceTypes, job }: RepairFormProps) {
  const t = useTranslations("RepairForm");
  const tr = useTranslations("Repairs");
  const tc = useTranslations("Common");
  const isEdit = !!job;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateRepairAction : createRepairAction,
    initState
  );
  const [type, setType] = useState<RepairType>(job?.type ?? RepairType.INTERNAL);
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.push("/repairs");
  }, [state.success, router]);

  const fieldError = (field: string) => state.errors?.[field]?.[0];
  const activeTechnicians = technicians.filter((tech) => tech.isActive || tech.id === job?.technicianId);
  // Keep an archived type visible on a job that already uses it, so editing
  // an old job doesn't silently blank its device type.
  const activeDeviceTypes = deviceTypes.filter((dt) => dt.isActive || dt.id === job?.deviceTypeId);

  return (
    <form action={formAction} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={job.id} />}

      {isEdit && (
        <p className="text-sm text-slate-500">
          {t("jobNumberLabel")}: <span className="font-mono font-semibold text-slate-700">{job.jobNumber}</span>
        </p>
      )}

      {/* Type */}
      <div>
        <label className="label">{t("typeLabel")}</label>
        <div className="flex gap-4">
          {Object.values(RepairType).map((v) => (
            <label key={v} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio" name="type" value={v} checked={type === v}
                onChange={() => setType(v)}
              />
              {tr(`type${v}`)}
            </label>
          ))}
        </div>
      </div>

      {/* Type-scoped fields */}
      {type === RepairType.INTERNAL ? (
        <div>
          <label className="label" htmlFor="departmentId">{t("departmentLabel")}</label>
          <select id="departmentId" name="departmentId" className="input" defaultValue={job?.departmentId ?? ""}>
            <option value="">{t("departmentPlaceholder")}</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {fieldError("departmentId") && <p className="mt-1 text-xs text-red-600">{fieldError("departmentId")}</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="customerName">{t("customerNameLabel")}</label>
            <input id="customerName" name="customerName" className="input" defaultValue={job?.customerName ?? ""} />
            {fieldError("customerName") && <p className="mt-1 text-xs text-red-600">{fieldError("customerName")}</p>}
          </div>
          <div>
            <label className="label" htmlFor="customerPhone">{t("customerPhoneLabel")}</label>
            <input id="customerPhone" name="customerPhone" className="input" defaultValue={job?.customerPhone ?? ""} />
          </div>
        </div>
      )}

      {/* Device owner — applies to internal and external jobs alike */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="ownerName">{t("ownerNameLabel")}</label>
          <input id="ownerName" name="ownerName" className="input" placeholder={t("ownerNamePlaceholder")} defaultValue={job?.ownerName ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="ownerTel">{t("ownerTelLabel")}</label>
          <input id="ownerTel" name="ownerTel" className="input" placeholder={t("ownerTelPlaceholder")} defaultValue={job?.ownerTel ?? ""} />
        </div>
      </div>

      {/* Device */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="deviceTypeId">{t("deviceTypeLabel")}</label>
          <select id="deviceTypeId" name="deviceTypeId" className="input" defaultValue={job?.deviceTypeId ?? ""}>
            <option value="">{t("deviceTypePlaceholder")}</option>
            {activeDeviceTypes.map((dt) => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="deviceName">{t("deviceNameLabel")}</label>
          <input id="deviceName" name="deviceName" className="input" placeholder={t("deviceNamePlaceholder")} defaultValue={job?.deviceName} required />
          {fieldError("deviceName") && <p className="mt-1 text-xs text-red-600">{fieldError("deviceName")}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="deviceModel">{t("deviceModelLabel")}</label>
          <input id="deviceModel" name="deviceModel" className="input" placeholder={t("deviceModelPlaceholder")} defaultValue={job?.deviceModel ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="serialNo">{t("serialNoLabel")}</label>
          <input id="serialNo" name="serialNo" className="input" defaultValue={job?.serialNo ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="serviceTag">{t("serviceTagLabel")}</label>
          <input id="serviceTag" name="serviceTag" className="input" placeholder={t("serviceTagPlaceholder")} defaultValue={job?.serviceTag ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="expressNo">{t("expressNoLabel")}</label>
          <input id="expressNo" name="expressNo" className="input" placeholder={t("expressNoPlaceholder")} defaultValue={job?.expressNo ?? ""} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="problem">{t("problemLabel")}</label>
        <textarea id="problem" name="problem" rows={2} className="input resize-none" placeholder={t("problemPlaceholder")} defaultValue={job?.problem} required />
        {fieldError("problem") && <p className="mt-1 text-xs text-red-600">{fieldError("problem")}</p>}
      </div>

      {/* Assignment */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label" htmlFor="technicianId">{t("technicianLabel")}</label>
          <select id="technicianId" name="technicianId" className="input" defaultValue={job?.technicianId ?? ""}>
            <option value="">{t("technicianPlaceholder")}</option>
            {activeTechnicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="status">{t("statusLabel")}</label>
          <select id="status" name="status" className="input" defaultValue={job?.status ?? RepairStatus.RECEIVED}>
            {Object.values(RepairStatus).map((s) => <option key={s} value={s}>{tr(`status${s}`)}</option>)}
          </select>
          {fieldError("status") && <p className="mt-1 text-xs text-red-600">{fieldError("status")}</p>}
        </div>
        <div>
          <label className="label" htmlFor="reportedAt">{t("reportedAtLabel")}</label>
          <input id="reportedAt" name="reportedAt" type="date" className="input" defaultValue={toDateInputValue(job?.reportedAt)} required />
        </div>
      </div>

      {/* Parts and cost */}
      <div>
        <label className="label" htmlFor="partsUsed">{t("partsUsedLabel")}</label>
        <textarea id="partsUsed" name="partsUsed" rows={2} className="input resize-none" placeholder={t("partsUsedPlaceholder")} defaultValue={job?.partsUsed ?? ""} />
        <p className="mt-1 text-xs text-slate-400">{t("partsUsedHint")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="partsCost">{t("partsCostLabel")}</label>
          <input id="partsCost" name="partsCost" type="number" min={0} step="0.01" className="input" placeholder="0.00" defaultValue={job?.partsCost ?? 0} />
          {fieldError("partsCost") && <p className="mt-1 text-xs text-red-600">{fieldError("partsCost")}</p>}
        </div>
        <div>
          <label className="label" htmlFor="labourCost">{t("labourCostLabel")}</label>
          <input id="labourCost" name="labourCost" type="number" min={0} step="0.01" className="input" placeholder="0.00" defaultValue={job?.labourCost ?? 0} />
          {fieldError("labourCost") && <p className="mt-1 text-xs text-red-600">{fieldError("labourCost")}</p>}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="note">{t("noteLabel")}</label>
        <textarea id="note" name="note" rows={2} className="input resize-none" defaultValue={job?.note ?? ""} />
      </div>

      {/* Attachments */}
      <div>
        <label className="label">{t("attachmentsLabel")}</label>
        {isEdit && <div className="mb-2"><RepairAttachments attachments={job.attachments} /></div>}
        <input name="files" type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" className="input" />
        <p className="mt-1 text-xs text-slate-400">{t("attachmentsHint")}</p>
      </div>

      {state.message && (
        <p className={clsx(
          "text-sm font-medium rounded-lg px-3 py-2",
          state.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        )}>
          {state.success ? "✅ " : "❌ "}{state.message}
        </p>
      )}

      <div className="pt-2 flex gap-3">
        <Link href="/repairs" className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors text-center">
          {tc("cancel")}
        </Link>
        <button type="submit" disabled={pending} className={clsx("btn-primary flex-1 justify-center py-2.5", pending && "opacity-60 cursor-not-allowed")}>
          {pending ? tc("saving") : isEdit ? t("saveEdit") : t("add")}
        </button>
      </div>
    </form>
  );
}
