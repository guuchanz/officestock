"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Trash2, Paperclip } from "lucide-react";
import { deleteRepairAction, type RepairListItem } from "@/actions/repair.actions";
import RepairStatusSelect from "./RepairStatusSelect";

export default function RepairRow({ job }: { job: RepairListItem }) {
  const t = useTranslations("Repairs");
  const tc = useTranslations("Common");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!confirm(t("confirmDelete", { jobNumber: job.jobNumber }))) return;
    setDeleting(true);
    setError("");
    const res = await deleteRepairAction(job.id);
    if (!res.success) setError(res.message);
    setDeleting(false);
  }

  const owner = job.type === "INTERNAL" ? job.department?.name ?? "-" : job.customerName ?? "-";

  return (
    <tr className="hover:bg-slate-50 align-top">
      <td className="px-5 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">{job.jobNumber}</td>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-800">
          {job.deviceType && (
            <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {job.deviceType.name}
            </span>
          )}
          {job.deviceName}
          {job.deviceModel && <span className="text-slate-400 font-normal"> · {job.deviceModel}</span>}
        </p>
        {(job.serialNo || job.serviceTag) && (
          <p className="text-[11px] text-slate-400 font-mono">
            {job.serialNo && `Assets ${job.serialNo}`}
            {job.serialNo && job.serviceTag && " · "}
            {job.serviceTag && `Tag ${job.serviceTag}`}
          </p>
        )}
        <p className="text-xs text-slate-500 line-clamp-1">{job.problem}</p>
        {job._count.attachments > 0 && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
            <Paperclip size={11} />{job._count.attachments}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-slate-600">
        <span className="text-xs text-slate-400 block">{t(`type${job.type}`)}</span>
        {owner}
        {job.ownerName && <span className="block text-xs text-slate-400">{job.ownerName}</span>}
      </td>
      <td className="px-4 py-3 text-slate-600">{job.technician?.name ?? "-"}</td>
      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
        {new Date(job.reportedAt).toLocaleDateString("th-TH")}
      </td>
      <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">
        {job.totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="px-4 py-3">
        <RepairStatusSelect id={job.id} status={job.status} />
      </td>
      <td className="px-5 py-3 text-right whitespace-nowrap">
        <Link href={`/repairs/${job.id}/edit`} className="inline-block p-1.5 text-slate-400 hover:text-blue-600" title={tc("edit")}>
          <Pencil size={15} />
        </Link>
        <button onClick={handleDelete} disabled={deleting} className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-50" title={tc("delete")}>
          <Trash2 size={15} />
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}
